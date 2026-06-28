import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/**
 * Create a streaming TTS session with ElevenLabs.
 * Sends text chunks, receives audio chunks.
 *
 * Uses the ElevenLabs WebSocket streaming API for lowest latency.
 * Output format: mulaw_8000 to match Twilio's expected format.
 */
export function createElevenLabsStream(voiceId?: string): {
  events: EventEmitter;
  send: (text: string) => void;
  flush: () => void;
  close: () => void;
} {
  const events = new EventEmitter();
  const voice = voiceId || config.elevenlabsVoiceId;
  const model = config.elevenlabsModelId;

  const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voice}/stream-input?model_id=${model}&output_format=ulaw_8000`;

  let ws: WebSocket | null = null;
  let isOpen = false;

  function connect() {
    ws = new WebSocket(wsUrl, {
      headers: {
        'xi-api-key': config.elevenlabsApiKey,
      },
    });

    ws.on('open', () => {
      isOpen = true;
      logger.debug('ElevenLabs WS connected');

      // Send BOS (beginning of stream) message
      ws!.send(JSON.stringify({
        text: ' ',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          use_speaker_boost: true,
        },
        generation_config: {
          chunk_length_schedule: [120, 160, 250, 290],
        },
      }));
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.audio) {
          // Base64 encoded audio chunk
          const audioBuffer = Buffer.from(msg.audio, 'base64');
          events.emit('audio', audioBuffer);
        }

        if (msg.isFinal) {
          events.emit('done');
        }
      } catch (err) {
        logger.error({ err }, 'Error parsing ElevenLabs message');
      }
    });

    ws.on('error', (err) => {
      logger.error({ err }, 'ElevenLabs WS error');
      events.emit('error', err);
    });

    ws.on('close', () => {
      isOpen = false;
      logger.debug('ElevenLabs WS closed');
      events.emit('close');
    });
  }

  connect();

  return {
    events,
    send: (text: string) => {
      if (!isOpen || !ws) {
        logger.warn('ElevenLabs WS not open, buffering text');
        return;
      }
      ws.send(JSON.stringify({ text, try_trigger_generation: true }));
    },
    flush: () => {
      // Send EOS (end of stream) to flush remaining audio
      if (isOpen && ws) {
        ws.send(JSON.stringify({ text: '' }));
      }
    },
    close: () => {
      isOpen = false;
      if (ws) {
        try {
          ws.close();
        } catch {
          // Already closed
        }
        ws = null;
      }
    },
  };
}
