import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { config } from '../config.js';
import { toE164 } from '../lib/utils.js';
import { logger } from '../lib/logger.js';
import * as store from '../services/call-store.js';
import { initiateOutboundCall } from '../providers/twilio.provider.js';
import { broadcastCallStatus } from '../ws/dashboard-ws.js';

export async function callRoutes(app: FastifyInstance) {
  // All call routes require auth
  app.addHook('onRequest', authMiddleware);

  /** POST /api/calls — initiate a new outbound call */
  app.post('/api/calls', async (request, reply) => {
    const { toNumber, prompt, voiceId, llmModel } = request.body as {
      toNumber: string;
      prompt: string;
      voiceId?: string;
      llmModel?: string;
    };

    if (!toNumber || !prompt) {
      return reply.status(400).send({
        success: false,
        error: 'toNumber and prompt are required',
      });
    }

    // Check if there's already an active call
    const active = store.getActiveCalls();
    if (active.length > 0) {
      return reply.status(409).send({
        success: false,
        error: 'A call is already in progress. End it before starting a new one.',
      });
    }

    const formattedNumber = toE164(toNumber);

    // Create call record in memory
    const call = store.createCallRecord({
      toNumber: formattedNumber,
      fromNumber: config.twilioPhoneNumber,
      prompt,
      voiceId: voiceId || config.elevenlabsVoiceId,
      llmModel: llmModel || config.defaultLlmModel,
    });

    logger.info({ callId: call.id, to: formattedNumber }, 'Initiating outbound call');

    try {
      // Initiate via Twilio
      const twilioSid = await initiateOutboundCall(call.id, formattedNumber);
      store.linkTwilioSid(call.id, twilioSid);
      store.updateCallStatus(call.id, 'ringing', {
        startedAt: new Date().toISOString(),
      });

      broadcastCallStatus(call.id, 'ringing');

      return reply.send({
        success: true,
        data: { callId: call.id, status: 'ringing' },
      });
    } catch (err: any) {
      logger.error({ err, callId: call.id }, 'Failed to initiate call');
      store.updateCallStatus(call.id, 'failed', { error: err.message });
      broadcastCallStatus(call.id, 'failed');

      return reply.status(500).send({
        success: false,
        error: `Failed to initiate call: ${err.message}`,
      });
    }
  });

  /** GET /api/calls — list all calls */
  app.get('/api/calls', async (_request, reply) => {
    const calls = store.getAllCalls();
    return reply.send({ success: true, data: calls });
  });

  /** GET /api/calls/active — get active call */
  app.get('/api/calls/active', async (_request, reply) => {
    const active = store.getActiveCalls();
    return reply.send({
      success: true,
      data: active.length > 0 ? active[0] : null,
    });
  });

  /** GET /api/calls/:id — get call detail */
  app.get('/api/calls/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const call = store.getCall(id);

    if (!call) {
      return reply.status(404).send({ success: false, error: 'Call not found' });
    }

    return reply.send({ success: true, data: call });
  });

  /** POST /api/calls/:id/end — end an active call */
  app.post('/api/calls/:id/end', async (request, reply) => {
    const { id } = request.params as { id: string };
    const call = store.getCall(id);

    if (!call) {
      return reply.status(404).send({ success: false, error: 'Call not found' });
    }

    if (call.status !== 'in-progress' && call.status !== 'ringing') {
      return reply.status(400).send({ success: false, error: 'Call is not active' });
    }

    try {
      // End via Twilio
      if (call.twilioCallSid) {
        const twilio = (await import('twilio')).default;
        const client = twilio(config.twilioAccountSid, config.twilioAuthToken);
        await client.calls(call.twilioCallSid).update({ status: 'completed' });
      }

      store.updateCallStatus(id, 'completed', {
        endedAt: new Date().toISOString(),
        duration: call.startedAt
          ? Math.round((Date.now() - new Date(call.startedAt).getTime()) / 1000)
          : 0,
      });

      broadcastCallStatus(id, 'completed');

      return reply.send({ success: true, data: { status: 'completed' } });
    } catch (err: any) {
      logger.error({ err, callId: id }, 'Failed to end call');
      return reply.status(500).send({
        success: false,
        error: `Failed to end call: ${err.message}`,
      });
    }
  });

  /** GET /api/calls/stats — dashboard stats */
  app.get('/api/stats', async (_request, reply) => {
    return reply.send({ success: true, data: store.getStats() });
  });
}
