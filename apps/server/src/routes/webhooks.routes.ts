import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import * as store from '../services/call-store.js';
import { broadcastCallStatus } from '../ws/dashboard-ws.js';

export async function webhookRoutes(app: FastifyInstance) {
  /**
   * /webhooks/twilio/voice (POST or GET)
   * Twilio requests this when the outbound call is answered.
   * We return TwiML that connects the call to our media WebSocket stream.
   */
  const handleVoiceWebhook = async (request: any, reply: any) => {
    const body = ((request.body || request.query || {}) as Record<string, string>);
    const callSid = body.CallSid || '';

    logger.info({ callSid, body }, 'Twilio voice webhook — call answered');

    // Find our call record by the Twilio SID
    const call = store.getCallBySid(callSid);
    if (call) {
      store.updateCallStatus(call.id, 'in-progress', {
        answeredAt: new Date().toISOString(),
      });
      broadcastCallStatus(call.id, 'in-progress');
    }

    // Return TwiML to connect the call to our WebSocket for bidirectional audio
    const wsHost = request.headers['x-forwarded-host'] || request.headers.host || config.twilioWebhookBaseUrl.replace(/^https?:\/\//, '');
    const wsUrl = `wss://${wsHost}`;
    const streamUrl = `${wsUrl}/ws/twilio-stream`;

    logger.info({ streamUrl, callId: call?.id }, 'Connecting Twilio Stream');

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Connecting to Vox Pilot.</Say>
  <Connect>
    <Stream name="voxpilot_stream" url="${streamUrl}">
      <Parameter name="callId" value="${call?.id || ''}" />
    </Stream>
  </Connect>
  <Pause length="3600"/>
</Response>`;

    reply.header('Content-Type', 'text/xml');
    return reply.send(twiml);
  };

  app.post('/webhooks/twilio/voice', handleVoiceWebhook);
  app.get('/webhooks/twilio/voice', handleVoiceWebhook);

  /**
   * POST /webhooks/twilio/status
   * Twilio sends call status updates here.
   */
  const handleStatusWebhook = async (request: any, reply: any) => {
    const body = ((request.body || request.query || {}) as Record<string, string>);
    const callSid = body.CallSid;
    const callStatus = body.CallStatus;
    const duration = body.CallDuration;

    logger.info({ callSid, callStatus, duration }, 'Twilio status webhook');

    const call = store.getCallBySid(callSid);
    if (!call) {
      logger.warn({ callSid }, 'Status webhook for unknown call');
      return reply.send({ success: true });
    }

    // Map Twilio status to our status
    const statusMap: Record<string, any> = {
      queued: 'queued',
      ringing: 'ringing',
      'in-progress': 'in-progress',
      completed: 'completed',
      failed: 'failed',
      busy: 'busy',
      'no-answer': 'no-answer',
      canceled: 'canceled',
    };

    const mappedStatus = statusMap[callStatus] || callStatus;
    const isTerminal = ['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(mappedStatus);

    store.updateCallStatus(call.id, mappedStatus, {
      ...(isTerminal && {
        endedAt: new Date().toISOString(),
        duration: duration ? parseInt(duration, 10) : undefined,
      }),
    });

    broadcastCallStatus(call.id, mappedStatus);

    return reply.send({ success: true });
  };

  app.post('/webhooks/twilio/status', handleStatusWebhook);
  app.get('/webhooks/twilio/status', handleStatusWebhook);
}
