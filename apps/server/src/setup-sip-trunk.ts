import SDK from '@fonoster/sdk';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function main() {
  const endpoint = process.env.FONOSTER_API_ENDPOINT || 'apiserver:50051';
  const accessKeyId = process.env.FONOSTER_ACCESS_KEY_ID!;
  const apiKey = process.env.FONOSTER_API_KEY!;
  const apiSecret = process.env.FONOSTER_API_SECRET!;
  const appRef = process.env.FONOSTER_APP_REF!;

  // Cellhub SIP credentials from .env
  const sipServer = process.env.CELLHUB_SIP_SERVER || '195.35.9.6';
  const sipUsername = process.env.CELLHUB_SIP_USERNAME!;
  const sipPassword = process.env.CELLHUB_SIP_PASSWORD!;
  const callerId = process.env.CELLHUB_CALLER_ID || '+18334589486';

  if (!accessKeyId || !apiKey || !apiSecret) {
    console.error('Missing FONOSTER_ACCESS_KEY_ID, FONOSTER_API_KEY, or FONOSTER_API_SECRET');
    process.exit(1);
  }
  if (!sipUsername || !sipPassword) {
    console.error('Missing CELLHUB_SIP_USERNAME or CELLHUB_SIP_PASSWORD');
    process.exit(1);
  }

  console.log('Connecting to Fonoster...');
  const client = new SDK.Client({ accessKeyId, endpoint, allowInsecure: true });
  await client.loginWithApiKey(apiKey, apiSecret);
  console.log('Authenticated!\n');

  // ── Step 1: Create SIP Credentials ──
  console.log('Step 1: Creating SIP Credentials for Cellhub...');
  const credsClient = new SDK.Credentials(client);
  const credsList = await credsClient.listCredentials({ pageSize: 50 }) as any;
  const existingCreds = (credsList.items || []).find((c: any) => c.name === 'Cellhub SIP');

  let credsRef: string;
  if (existingCreds) {
    credsRef = existingCreds.ref;
    console.log(`  Already exists: ${credsRef}`);
  } else {
    console.log(`  Registering credentials with username: ${sipUsername.toLowerCase()}`);
    const credsResult = await credsClient.createCredentials({
      name: 'Cellhub SIP',
      username: sipUsername.toLowerCase(),
      password: sipPassword
    });
    credsRef = credsResult.ref;
    console.log(`  Created: ${credsRef}`);
  }

  // ── Step 2: Create SIP Trunk ──
  console.log('\nStep 2: Creating SIP Trunk for Cellhub...');
  const trunksClient = new SDK.Trunks(client);
  const trunksList = await trunksClient.listTrunks({ pageSize: 50 }) as any;
  const existingTrunk = (trunksList.items || []).find((t: any) => t.name === 'Cellhub Trunk');

  let trunkRef: string;
  if (existingTrunk) {
    trunkRef = existingTrunk.ref;
    console.log(`  Already exists: ${trunkRef}`);
  } else {
    const trunkResult = await trunksClient.createTrunk({
      name: 'Cellhub Trunk',
      inboundUri: sipServer,
      sendRegister: true,
      outboundCredentialsRef: credsRef,
      uris: [{
        host: sipServer,
        port: 5060,
        transport: 'UDP' as any,
        user: sipUsername.toLowerCase(),
        weight: 1,
        priority: 1,
        enabled: true
      }]
    });
    trunkRef = trunkResult.ref;
    console.log(`  Created: ${trunkRef}`);
  }

  // ── Step 3: Register Phone Number ──
  console.log('\nStep 3: Registering phone number...');
  const numbersClient = new SDK.Numbers(client);
  const numbersList = await numbersClient.listNumbers({ pageSize: 50 }) as any;
  const telUrl = `tel:${callerId}`;
  const existingNumber = (numbersList.items || []).find((n: any) => n.telUrl === telUrl);

  let numberRef: string;
  if (existingNumber) {
    numberRef = existingNumber.ref;
    console.log(`  Already exists: ${numberRef}`);
  } else {
    const numberResult = await numbersClient.createNumber({
      name: 'Cellhub Main Line',
      telUrl,
      city: 'US',
      country: 'United States',
      countryIsoCode: 'US',
      trunkRef,
      appRef
    } as any);
    numberRef = numberResult.ref;
    console.log(`  Created: ${numberRef}`);
  }

  console.log('\n======================================================');
  console.log('🎉 SIP TRUNK CONFIGURATION COMPLETED!');
  console.log('======================================================\n');
  console.log(`  Credentials Ref: ${credsRef}`);
  console.log(`  Trunk Ref:       ${trunkRef}`);
  console.log(`  Number Ref:      ${numberRef}`);
  console.log(`  Phone Number:    ${callerId}`);
  console.log(`  App Ref:         ${appRef}`);
  console.log('\n  Inbound calls to', callerId, 'will be routed to voxPilot!');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
});
