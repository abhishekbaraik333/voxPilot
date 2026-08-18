import twilio from 'twilio';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!client) {
    if (!config.twilioAccountSid || !config.twilioAccountSid.startsWith('AC')) {
      throw new Error('TWILIO_ACCOUNT_SID must start with "AC". Please update your .env file with your Twilio Account SID.');
    }
    client = twilio(config.twilioAccountSid, config.twilioAuthToken);
  }
  return client;
}

/**
 * Initiate an outbound call via Twilio.
 * When the callee answers, Twilio will request TwiML from our voice webhook,
 * which will return <Connect><Stream> to start bidirectional audio.
 */
export async function initiateOutboundCall(callId: string, toNumber: string): Promise<string> {
  logger.info({ callId, to: toNumber, from: config.twilioPhoneNumber }, 'Creating Twilio call');

  const twilioClient = getClient();
  const call = await twilioClient.calls.create({
    to: toNumber,
    from: config.twilioPhoneNumber,
    url: `${config.twilioWebhookBaseUrl}/webhooks/twilio/voice`,
    statusCallback: `${config.twilioWebhookBaseUrl}/webhooks/twilio/status`,
  });

  logger.info({ callId, sid: call.sid }, 'Twilio call created');
  return call.sid;
}

/**
 * End an active call via Twilio.
 */
export async function endCall(callSid: string): Promise<void> {
  const twilioClient = getClient();
  await twilioClient.calls(callSid).update({ status: 'completed' });
  logger.info({ sid: callSid }, 'Twilio call ended');
}
