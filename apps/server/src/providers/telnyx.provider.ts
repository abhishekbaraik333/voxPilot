import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/**
 * Initiate an outbound call via Telnyx TeXML.
 * When the callee answers, Telnyx will request TeXML from our voice webhook,
 * which will return <Connect><Stream> to start bidirectional audio.
 */
export async function initiateOutboundCall(callId: string, toNumber: string): Promise<string> {
  logger.info({ callId, to: toNumber, from: config.telnyxPhoneNumber }, 'Creating Telnyx TeXML call');

  const response = await fetch(`https://api.telnyx.com/v2/texml/calls/${config.telnyxConnectionId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.telnyxApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      To: toNumber,
      From: config.telnyxPhoneNumber,
      Url: `${config.twilioWebhookBaseUrl}/webhooks/twilio/voice`,
      StatusCallback: `${config.twilioWebhookBaseUrl}/webhooks/twilio/status`,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error({ errText, callId }, 'Failed to create Telnyx call');
    throw new Error(`Telnyx API error: ${response.status} - ${errText}`);
  }

  const json = await response.json() as any;
  const callSid = json.data?.call_sid;

  if (!callSid) {
    throw new Error('Telnyx response did not contain call_sid');
  }

  logger.info({ callId, sid: callSid }, 'Telnyx call created successfully');
  return callSid;
}

/**
 * End an active call via Telnyx Call Control.
 */
export async function endCall(callSid: string): Promise<void> {
  const response = await fetch(`https://api.telnyx.com/v2/calls/${callSid}/actions/hangup`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.telnyxApiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok && response.status !== 404) {
    const errText = await response.text();
    logger.error({ errText, callSid }, 'Failed to terminate Telnyx call');
  } else {
    logger.info({ sid: callSid }, 'Telnyx call ended');
  }
}
