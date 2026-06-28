import twilio from 'twilio';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const client = twilio(config.twilioAccountSid, config.twilioAuthToken);

/**
 * Initiate an outbound call via Twilio.
 * When the callee answers, Twilio will request TwiML from our voice webhook,
 * which will return <Connect><Stream> to start bidirectional audio.
 */
export async function initiateOutboundCall(callId: string, toNumber: string): Promise<string> {
  logger.info({ callId, to: toNumber, from: config.twilioPhoneNumber }, 'Creating Twilio call');

  const call = await client.calls.create({
    to: toNumber,
    from: config.twilioPhoneNumber,
    url: `${config.twilioWebhookBaseUrl}/webhooks/twilio/voice`,
    statusCallback: `${config.twilioWebhookBaseUrl}/webhooks/twilio/status`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
    // Record the call if enabled
    // record: config.enableRecording,
  });

  logger.info({ callId, sid: call.sid }, 'Twilio call created');
  return call.sid;
}

/**
 * End an active call via Twilio.
 */
export async function endCall(callSid: string): Promise<void> {
  await client.calls(callSid).update({ status: 'completed' });
  logger.info({ sid: callSid }, 'Twilio call ended');
}
