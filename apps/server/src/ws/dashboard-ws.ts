import type { FastifyInstance } from 'fastify';
import type WebSocket from 'ws';
import type { CallStatus, TranscriptEntry, CallEvent } from '@voxpilot/shared';
import { WS_EVENTS } from '@voxpilot/shared';
import { logger } from '../lib/logger.js';

/** Connected dashboard WebSocket clients */
const clients = new Set<WebSocket>();

/**
 * Register the dashboard WebSocket endpoint.
 * Dashboard clients connect here to receive real-time call events.
 */
export async function registerDashboardWs(app: FastifyInstance) {
  app.get('/ws/dashboard', { websocket: true }, (socket, _req) => {
    logger.info('Dashboard client connected');
    clients.add(socket);

    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        logger.debug({ event: msg.event }, 'Dashboard WS message received');
        // Handle subscribe/unsubscribe if needed in the future
      } catch {
        // Ignore invalid messages
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
      logger.info('Dashboard client disconnected');
    });

    socket.on('error', (err) => {
      logger.error({ err }, 'Dashboard WS error');
      clients.delete(socket);
    });
  });
}

/** Broadcast a message to all connected dashboard clients */
function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({
    event,
    data,
    timestamp: new Date().toISOString(),
  });

  for (const client of clients) {
    try {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(message);
      }
    } catch (err) {
      logger.error({ err }, 'Error broadcasting to dashboard client');
    }
  }
}

// ─── Broadcast Helpers ───────────────────────────────────────

export function broadcastCallStatus(callId: string, status: CallStatus) {
  broadcast(WS_EVENTS.CALL_STATUS, {
    callId,
    status,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastTranscript(callId: string, entry: TranscriptEntry) {
  broadcast(WS_EVENTS.CALL_TRANSCRIPT, { callId, entry });
}

export function broadcastAgentResponse(callId: string, text: string, timestampMs: number) {
  broadcast(WS_EVENTS.CALL_AGENT_RESPONSE, { callId, text, timestampMs });
}

export function broadcastCallEvent(callId: string, event: CallEvent) {
  broadcast(WS_EVENTS.CALL_EVENT, { callId, event });
}

export function broadcastCallEnded(callId: string) {
  broadcast(WS_EVENTS.CALL_ENDED, { callId });
}
