import VoiceServer from '@fonoster/voice';
import { createSession, removeSession } from '../services/call-orchestrator.js';
import * as store from '../services/call-store.js';
import { logger } from '../lib/logger.js';
import { broadcastCallStatus, broadcastCallEnded } from '../ws/dashboard-ws.js';

export function startVoiceServer(port: number) {
  logger.info({ port }, 'Starting Fonoster Voice Server');

  const VoiceServerClass = (VoiceServer as any).default || VoiceServer;
  const voiceServer = new VoiceServerClass({ port });

  voiceServer.listen(async (req: any, response: any) => {
    const callId = req.metadata?.callId || '';
    const callRef = req.callRef;

    logger.info({ callId, callRef }, 'Fonoster Voice Server received call answered');

    // 1. Find call record and update status
    const call = store.getCall(callId);
    if (call) {
      store.updateCallStatus(call.id, 'in-progress', {
        answeredAt: new Date().toISOString(),
      });
      broadcastCallStatus(call.id, 'in-progress');
    }

    // 2. Answer the call
    await response.answer();

    // 3. Create or get CallSession
    const session = createSession(callId, callRef);

    // 4. Set hangup handler so API / dashboard can end the call
    session.setHangupHandler(async () => {
      logger.info({ callId, callRef }, 'Hanging up call via VoiceResponse');
      try {
        await response.hangup();
      } catch (err) {
        logger.error({ err, callId }, 'Error executing response.hangup()');
      }
    });

    // Handle session end/error events from the voice connection
    response.on('end', () => {
      logger.info({ callId, callRef }, 'VoiceResponse session ended (call completed)');
      store.updateCallStatus(callId, 'completed', {
        endedAt: new Date().toISOString(),
        duration: store.getCall(callId)?.startedAt
          ? Math.round((Date.now() - new Date(store.getCall(callId)!.startedAt!).getTime()) / 1000)
          : 0,
      });
      broadcastCallStatus(callId, 'completed');
      broadcastCallEnded(callId);
      removeSession(callId);
    });

    response.on('error', (err: any) => {
      logger.error({ err, callId, callRef }, 'VoiceResponse session error');
      store.updateCallStatus(callId, 'failed', { error: err.message });
      broadcastCallStatus(callId, 'failed');
      broadcastCallEnded(callId);
      removeSession(callId);
    });

    // 5. Connect stream
    try {
      const stream = await response.stream({
        direction: 'BOTH' as any,
      });

      session.setFonosterStream(stream);

      // Listen for incoming audio from caller
      stream.onPayload((payload: any) => {
        // Feed format and reference details to the session
        session.setStreamInfo(payload.mediaSessionRef, payload.streamRef, payload.format);
        
        // Pass raw audio payload to Deepgram STT
        if (payload.type === 'AUDIO_IN') {
          session.handleFonosterAudio(payload.data!);
        }
      });

      // Start the pipeline (initial greeting, deepgram, elevenlabs)
      await session.start();

    } catch (err) {
      logger.error({ err, callId }, 'Error establishing bidirectional audio stream');
      try {
        await response.hangup();
      } catch {}
      removeSession(callId);
    }
  });
}
