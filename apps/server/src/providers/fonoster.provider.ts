import SDK from '@fonoster/sdk';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

let clientInstance: any = null;

async function getClient() {
  if (clientInstance) return clientInstance;

  logger.info({ endpoint: config.fonosterEndpoint, accessKeyId: config.fonosterAccessKeyId }, 'Initializing Fonoster client');
  clientInstance = new SDK.Client({
    accessKeyId: config.fonosterAccessKeyId,
    endpoint: config.fonosterEndpoint,
    allowInsecure: true,
  });

  await clientInstance.loginWithApiKey(config.fonosterApiKey, config.fonosterApiSecret);
  return clientInstance;
}

export async function initiateOutboundCall(callId: string, toNumber: string): Promise<string> {
  logger.info({ callId, to: toNumber, from: config.cellhubCallerId }, 'Creating Fonoster outbound call');

  const client = await getClient();
  const calls = new SDK.Calls(client);

  const response = await calls.createCall({
    from: config.cellhubCallerId,
    to: toNumber,
    appRef: config.fonosterAppRef,
  });

  const callRef = response.ref;
  logger.info({ callId, ref: callRef }, 'Fonoster call initiated successfully');

  return callRef;
}
