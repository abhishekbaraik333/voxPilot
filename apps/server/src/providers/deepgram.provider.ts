import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { EventEmitter } from 'events';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const deepgram = createClient(config.deepgramApiKey);

export interface DeepgramTranscript {
  text: string;
  isFinal: boolean;
  confidence: number;
  speechFinal: boolean;
}

/**
 * Create a streaming STT session with Deepgram.
 * Returns an EventEmitter that emits 'transcript' events and a send() function
 * to pipe audio data into.
 */
export function createDeepgramStream(): {
  events: EventEmitter;
  send: (audio: Buffer) => void;
  close: () => void;
} {
  const events = new EventEmitter();

  const connection = deepgram.listen.live({
    model: 'nova-2',
    language: 'en',
    smart_format: true,
    interim_results: true,
    utterance_end_ms: 1000,
    vad_events: true,
    encoding: 'linear16',
    sample_rate: 16000,
    channels: 1,
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    logger.debug('Deepgram connection opened');
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
    const alt = data.channel?.alternatives?.[0];
    if (!alt?.transcript) return;

    const transcript: DeepgramTranscript = {
      text: alt.transcript,
      isFinal: data.is_final ?? false,
      confidence: alt.confidence ?? 0,
      speechFinal: data.speech_final ?? false,
    };

    events.emit('transcript', transcript);
  });

  connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
    events.emit('utterance_end');
  });

  connection.on(LiveTranscriptionEvents.Error, (err: any) => {
    logger.error({ err }, 'Deepgram error');
    events.emit('error', err);
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    logger.debug('Deepgram connection closed');
    events.emit('close');
  });

  return {
    events,
    send: (audio: Buffer) => {
      try {
        connection.send(audio as any);
      } catch (err) {
        logger.error({ err }, 'Error sending audio to Deepgram');
      }
    },
    close: () => {
      try {
        connection.requestClose();
      } catch {
        // Already closed
      }
    },
  };
}
