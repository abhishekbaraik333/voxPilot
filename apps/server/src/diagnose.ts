
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import SDK from '@fonoster/sdk';
import { createClient } from '@deepgram/sdk';
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const blue = (text: string) => `\x1b[34m${text}\x1b[0m`;

console.log(blue('\n=== VoxPilot System Diagnostics ===\n'));

async function testFonoster() {
  console.log('Testing Fonoster Connection...');
  const endpoint = process.env.FONOSTER_API_ENDPOINT || 'localhost:50051';
  const accessKeyId = process.env.FONOSTER_ACCESS_KEY_ID;
  const apiKey = process.env.FONOSTER_API_KEY;
  const apiSecret = process.env.FONOSTER_API_SECRET;

  if (!accessKeyId || !apiKey || !apiSecret) {
    console.log(red('✖ Fonoster: Configuration missing in .env\n'));
    return false;
  }

  try {
    const client = new SDK.Client({ accessKeyId, endpoint });
    await client.loginWithApiKey(apiKey, apiSecret);
    const calls = new SDK.Calls(client);
    await calls.listCalls({ pageSize: 1 });
    console.log(green(`✔ Fonoster: Connected. Active Workspace ID: ${accessKeyId}`));
    console.log(green(`  Endpoint: ${endpoint}\n`));
    return true;
  } catch (err: any) {
    console.log(red(`✖ Fonoster Failed: ${err.message}\n`));
    return false;
  }
}

async function testDeepgram() {
  console.log('Testing Deepgram Connection...');
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    console.log(red('✖ Deepgram: API key missing in .env\n'));
    return false;
  }

  try {
    const deepgram = createClient(apiKey);
    const { result, error } = await deepgram.manage.getProjects();
    if (error) throw error;
    console.log(green(`✔ Deepgram: Connected. Found ${result.projects.length} project(s).`));
    console.log(green(`  Project ID: ${result.projects[0]?.project_id || 'N/A'}\n`));
    return true;
  } catch (err: any) {
    console.log(red(`✖ Deepgram Failed: ${err.message}\n`));
    return false;
  }
}

async function testLLM() {
  console.log('Testing LLM (OpenRouter)...');
  const orKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.DEFAULT_LLM_MODEL || 'inclusionai/ling-2.6-flash';

  const baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

  if (!orKey) {
    console.log(red('✖ LLM: OpenRouter API key missing in .env\n'));
    return false;
  }

  console.log(blue(`  Using OpenRouter baseURL: ${baseURL}`));
  console.log(blue(`  Selected Model: ${model}`));

  try {
    const openai = new OpenAI({
      baseURL,
      apiKey: orKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://voxpilot.app',
        'X-Title': 'VoxPilot Diagnostics',
      }
    });

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are testing a connection.' },
        { role: 'user', content: 'Say "Hello World" in exactly two words.' }
      ],
      max_tokens: 10,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    console.log(green(`✔ LLM: Connected. Response: "${response}"\n`));
    return true;
  } catch (err: any) {
    console.log(red(`✖ LLM Failed: ${err.message}\n`));
    return false;
  }
}

async function testElevenLabs() {
  console.log('Testing ElevenLabs Connection...');
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

  if (!apiKey) {
    console.log(red('✖ ElevenLabs: API key missing in .env\n'));
    return false;
  }

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      headers: {
        'xi-api-key': apiKey,
      }
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: { status: res.statusText } }));
      throw new Error(errBody.detail?.status || `HTTP ${res.status}`);
    }

    const voiceData = (await res.json()) as any;
    console.log(green(`✔ ElevenLabs: Connected. Voice: "${voiceData.name}", Category: ${voiceData.category}`));
    console.log(green(`  Default Model: ${process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5'}\n`));
    return true;
  } catch (err: any) {
    console.log(red(`✖ ElevenLabs Failed: ${err.message}\n`));
    return false;
  }
}

async function runAll() {
  const fonosterOk = await testFonoster();
  const dgOk = await testDeepgram();
  const llmOk = await testLLM();
  const elOk = await testElevenLabs();

  console.log(blue('=== Diagnostic Summary ==='));
  console.log(`Fonoster:    ${fonosterOk ? green('PASSED') : red('FAILED')}`);
  console.log(`Deepgram:    ${dgOk ? green('PASSED') : red('FAILED')}`);
  console.log(`LLM Provider: ${llmOk ? green('PASSED') : red('FAILED')}`);
  console.log(`ElevenLabs:  ${elOk ? green('PASSED') : red('FAILED')}`);
  console.log();

  if (fonosterOk && dgOk && llmOk && elOk) {
    console.log(green('🚀 All systems are GO! You are ready to start placing outbound calls.'));
  } else {
    console.log(yellow('⚠ Some systems failed. Please review your credentials in the .env file.'));
  }
  console.log();
}

runAll();
