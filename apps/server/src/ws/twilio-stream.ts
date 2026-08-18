import { WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { logger } from '../lib/logger.js';
import { createSession, removeSession } from '../services/call-orchestrator.js';
import * as store from '../services/call-store.js';
import { broadcastCallStatus, broadcastCallEnded } from './dashboard-ws.js';

/**
 * Handle incoming Twilio media stream WebSocket connections.
 * Twilio connects here when a call is answered (via <Connect><Stream> TwiML).
 * Handles bidirectional audio: receives caller audio, sends agent audio back.
 */
export function handleTwilioStreamConnection(socket: WebSocket, req: IncomingMessage) {
  let callId = '';
  let streamSid = '';

  const urlObj = new URL(req.url || '', 'http://localhost');
  callId = urlObj.searchParams.get('callId') || '';

  logger.info({ callId, url: req.url }, 'Twilio media stream WebSocket connected');

  socket.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      logger.debug({ event: msg.event, callId }, 'Twilio stream event received');

      switch (msg.event) {
        case 'connected':
          logger.info('Twilio stream: connected event');
          break;

        case 'start': {
          streamSid = msg.start.streamSid;
          if (msg.start.customParameters?.callId) {
            callId = msg.start.customParameters.callId;
          }

          logger.info(
            { streamSid, callId, tracks: msg.start.tracks },
            'Twilio stream: start event'
          );

          if (!callId) {
            // Try to find call by looking at active calls
            const active = store.getActiveCalls();
            if (active.length > 0) {
              callId = active[0].id;
            }
          }

          if (callId) {
            // Create and start the audio pipeline session
            const session = createSession(callId, streamSid);
            session.setTwilioSender((payload) => {
              try {
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(payload);
                }
              } catch (err) {
                logger.error({ err }, 'Error sending audio to Twilio');
              }
            });
            await session.start();
          }
          break;
        }

        case 'media': {
          if (!callId) break;
          const { getSession } = await import('../services/call-orchestrator.js');
          const session = getSession(callId);
          if (session) {
            session.handleTwilioAudio(msg.media.payload);
          }
          break;
        }

        case 'stop': {
          logger.info({ callId, streamSid }, 'Twilio stream: stop event');

          if (callId) {
            const call = store.getCall(callId);
            if (call && call.status === 'in-progress') {
              store.updateCallStatus(callId, 'completed', {
                endedAt: new Date().toISOString(),
                duration: call.startedAt
                  ? Math.round((Date.now() - new Date(call.startedAt).getTime()) / 1000)
                  : 0,
              });
              broadcastCallStatus(callId, 'completed');
              broadcastCallEnded(callId);
            }
            removeSession(callId);
          }
          break;
        }

        default:
          logger.debug({ event: msg.event, callId }, 'Twilio stream: unhandled event');
      }
    } catch (err) {
      logger.error({ err }, 'Error processing Twilio stream message');
    }
  });

  socket.on('close', (code, reason) => {
    logger.info({ callId, streamSid, code, reason: reason?.toString() }, 'Twilio media stream disconnected');
    if (callId) {
      removeSession(callId);
    }
  });

  socket.on('error', (err) => {
    logger.error({ err, callId }, 'Twilio stream WS error');
  });
}
