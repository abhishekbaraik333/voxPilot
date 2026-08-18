import { EventEmitter } from 'events';
import { logger } from '../lib/logger.js';
import { createDeepgramStream, type DeepgramTranscript } from '../providers/deepgram.provider.js';
import { createElevenLabsStream } from '../providers/elevenlabs.provider.js';
import { streamChatCompletion, buildSystemPrompt, type LlmMessage } from '../providers/llm.provider.js';
import * as store from './call-store.js';
import { broadcastTranscript, broadcastAgentResponse, broadcastCallEvent, broadcastCallStatus } from '../ws/dashboard-ws.js';

/**
 * CallSession manages the live audio pipeline for a single call:
 *   Twilio audio → Deepgram STT → LLM → ElevenLabs TTS → Twilio audio
 *
 * It handles turn-taking, interruptions, and conversation history.
 */
export class CallSession extends EventEmitter {
  public readonly callId: string;
  private readonly prompt: string;
  private readonly voiceId: string;
  private readonly llmModel: string;
  private readonly streamSid: string;

  // Provider streams
  private deepgram: ReturnType<typeof createDeepgramStream> | null = null;
  private tts: ReturnType<typeof createElevenLabsStream> | null = null;

  // Conversation state
  private conversationHistory: LlmMessage[] = [];
  private currentUserUtterance = '';
  private isAgentSpeaking = false;
  private isProcessing = false;
  private callStartTime: number;

  // Twilio WebSocket reference (set externally)
  private twilioWsSend: ((data: string) => void) | null = null;

  constructor(callId: string, streamSid: string) {
    super();
    this.callId = callId;
    this.streamSid = streamSid;
    this.callStartTime = Date.now();

    const call = store.getCall(callId);
    this.prompt = call?.prompt || 'You are a helpful assistant on a phone call.';
    this.voiceId = call?.voiceId || '';
    this.llmModel = call?.llmModel || '';

    // Initialize conversation with system prompt
    this.conversationHistory = [
      { role: 'system', content: buildSystemPrompt(this.prompt) },
    ];

    logger.info({ callId, streamSid }, 'CallSession created');
  }

  /** Set the function to send audio back to Twilio */
  setTwilioSender(sendFn: (data: string) => void) {
    this.twilioWsSend = sendFn;
  }

  /** Start the STT and TTS streams */
  async start() {
    // Start Deepgram STT
    this.deepgram = createDeepgramStream();

    this.deepgram.events.on('transcript', (transcript: DeepgramTranscript) => {
      this.handleTranscript(transcript);
    });

    this.deepgram.events.on('utterance_end', () => {
      this.handleUtteranceEnd();
    });

    this.deepgram.events.on('error', (err) => {
      logger.error({ err, callId: this.callId }, 'Deepgram error in session');
    });

    // Start ElevenLabs TTS
    this.tts = createElevenLabsStream(this.voiceId);

    this.tts.events.on('audio', (audioBuffer: Buffer) => {
      this.sendAudioToTwilio(audioBuffer);
    });

    this.tts.events.on('done', () => {
      this.isAgentSpeaking = false;
      store.addCallEvent(this.callId, {
        type: 'agent_speaking',
        data: { speaking: false },
        timestampMs: this.elapsed(),
      });
    });

    this.tts.events.on('error', (err) => {
      logger.error({ err, callId: this.callId }, 'ElevenLabs error in session');
    });

    // Generate initial greeting
    await this.generateAgentResponse(true);

    logger.info({ callId: this.callId }, 'CallSession started — pipeline active');
  }

  /** Handle incoming audio from Twilio (mulaw 8kHz, base64) */
  handleTwilioAudio(audioPayload: string) {
    if (!this.deepgram) return;
    const audioBuffer = Buffer.from(audioPayload, 'base64');
    this.deepgram.send(audioBuffer);
  }

  /** Handle transcript from Deepgram */
  private handleTranscript(transcript: DeepgramTranscript) {
    if (!transcript.text.trim()) return;

    const timestampMs = this.elapsed();

    // Broadcast to dashboard
    const entry = store.addTranscriptEntry(this.callId, {
      role: 'user',
      content: transcript.text,
      timestampMs,
      isFinal: transcript.isFinal,
      confidence: transcript.confidence,
    });

    if (entry) {
      broadcastTranscript(this.callId, entry);
    }

    if (transcript.isFinal) {
      this.currentUserUtterance += ' ' + transcript.text;

      // If user interrupts the agent, stop TTS playback
      if (this.isAgentSpeaking) {
        this.handleInterruption();
      }
    }

    // If speech is final (end of sentence), trigger LLM
    if (transcript.speechFinal && this.currentUserUtterance.trim()) {
      this.handleUtteranceEnd();
    }
  }

  /** Handle end of user utterance — trigger LLM response */
  private async handleUtteranceEnd() {
    const userText = this.currentUserUtterance.trim();
    if (!userText || this.isProcessing) return;

    this.currentUserUtterance = '';
    this.conversationHistory.push({ role: 'user', content: userText });

    logger.debug({ callId: this.callId, userText }, 'User utterance complete');

    await this.generateAgentResponse(false);
  }

  /** Generate and stream agent response through LLM → TTS */
  private async generateAgentResponse(isGreeting: boolean) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const messages = isGreeting
        ? [
            ...this.conversationHistory,
            {
              role: 'user' as const,
              content: 'The call just connected. Greet the person naturally and introduce yourself according to your instructions. Keep it brief — one or two sentences.',
            },
          ]
        : this.conversationHistory;

      let fullResponse = '';
      let sentenceBuffer = '';

      store.addCallEvent(this.callId, {
        type: 'agent_thinking',
        timestampMs: this.elapsed(),
      });

      for await (const token of streamChatCompletion(messages, this.llmModel)) {
        fullResponse += token;
        sentenceBuffer += token;

        // Send to TTS in sentence chunks for natural speech
        const sentenceEnd = sentenceBuffer.match(/[.!?,;:]\s/);
        if (sentenceEnd && sentenceEnd.index !== undefined) {
          const sentence = sentenceBuffer.slice(0, sentenceEnd.index + 1);
          sentenceBuffer = sentenceBuffer.slice(sentenceEnd.index + 2);

          if (sentence.trim()) {
            this.isAgentSpeaking = true;
            this.tts?.send(sentence + ' ');
          }
        }
      }

      // Flush remaining text
      if (sentenceBuffer.trim()) {
        this.isAgentSpeaking = true;
        this.tts?.send(sentenceBuffer);
      }
      this.tts?.flush();

      // Store agent response
      this.conversationHistory.push({ role: 'assistant', content: fullResponse });

      const entry = store.addTranscriptEntry(this.callId, {
        role: 'agent',
        content: fullResponse,
        timestampMs: this.elapsed(),
        isFinal: true,
      });

      if (entry) {
        broadcastAgentResponse(this.callId, fullResponse, this.elapsed());
        broadcastTranscript(this.callId, entry);
      }

      logger.debug({ callId: this.callId, response: fullResponse.slice(0, 100) }, 'Agent response complete');
    } catch (err) {
      logger.error({ err, callId: this.callId }, 'Error generating agent response');

      // Fallback: speak an error message
      this.tts?.send("I'm sorry, I'm having a bit of trouble. Could you repeat that?");
      this.tts?.flush();
    } finally {
      this.isProcessing = false;
    }
  }

  /** Handle user interruption — stop current TTS playback */
  private handleInterruption() {
    logger.debug({ callId: this.callId }, 'User interrupted agent');

    // Clear Twilio playback buffer
    if (this.twilioWsSend) {
      this.twilioWsSend(JSON.stringify({
        event: 'clear',
        streamSid: this.streamSid,
      }));
    }

    // Close and recreate TTS stream
    this.tts?.close();
    this.tts = createElevenLabsStream(this.voiceId);

    this.tts.events.on('audio', (audioBuffer: Buffer) => {
      this.sendAudioToTwilio(audioBuffer);
    });

    this.tts.events.on('done', () => {
      this.isAgentSpeaking = false;
    });

    this.isAgentSpeaking = false;
    this.isProcessing = false;

    store.addCallEvent(this.callId, {
      type: 'interruption',
      timestampMs: this.elapsed(),
    });

    broadcastCallEvent(this.callId, {
      id: '',
      type: 'interruption',
      timestampMs: this.elapsed(),
    });
  }

  /** Send audio back to Twilio */
  private sendAudioToTwilio(audioBuffer: Buffer) {
    if (!this.twilioWsSend) return;

    const payload = JSON.stringify({
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload: audioBuffer.toString('base64'),
      },
    });

    this.twilioWsSend(payload);
  }

  /** Get elapsed time since call start in ms */
  private elapsed(): number {
    return Date.now() - this.callStartTime;
  }

  /** Clean up all resources */
  destroy() {
    logger.info({ callId: this.callId }, 'Destroying CallSession');
    this.deepgram?.close();
    this.tts?.close();
    this.deepgram = null;
    this.tts = null;
    this.twilioWsSend = null;
    this.removeAllListeners();
  }
}

// ─── Active Sessions Registry ────────────────────────────────

const activeSessions = new Map<string, CallSession>();

export function getSession(callId: string): CallSession | undefined {
  return activeSessions.get(callId);
}

export function createSession(callId: string, streamSid: string): CallSession {
  const session = new CallSession(callId, streamSid);
  activeSessions.set(callId, session);
  return session;
}

export function removeSession(callId: string) {
  const session = activeSessions.get(callId);
  if (session) {
    session.destroy();
    activeSessions.delete(callId);
  }
}
