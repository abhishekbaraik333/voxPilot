import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from monorepo root (two levels up from apps/server/src/)
dotenv.config({ path: resolve(__dirname, '../../../.env') });

/** Validated server configuration — crashes early if required vars are missing */
function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  // Server
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '3001'), 10),
  host: optionalEnv('HOST', '0.0.0.0'),

  // Auth
  jwtSecret: optionalEnv('JWT_SECRET', 'dev-secret-change-in-production-please'),
  adminEmail: optionalEnv('ADMIN_EMAIL', 'admin@voxpilot.local'),
  adminPassword: optionalEnv('ADMIN_PASSWORD', 'changeme123'),

  // Twilio
  twilioAccountSid: requireEnv('TWILIO_ACCOUNT_SID'),
  twilioAuthToken: requireEnv('TWILIO_AUTH_TOKEN'),
  twilioPhoneNumber: requireEnv('TWILIO_PHONE_NUMBER'),
  twilioWebhookBaseUrl: optionalEnv('TWILIO_WEBHOOK_BASE_URL', 'http://localhost:3001'),

  // Deepgram
  deepgramApiKey: requireEnv('DEEPGRAM_API_KEY'),

  // ElevenLabs
  elevenlabsApiKey: requireEnv('ELEVENLABS_API_KEY'),
  elevenlabsVoiceId: optionalEnv('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'), // Rachel
  elevenlabsModelId: optionalEnv('ELEVENLABS_MODEL_ID', 'eleven_turbo_v2_5'),

  // LLM
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterBaseUrl: optionalEnv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  defaultLlmModel: optionalEnv('DEFAULT_LLM_MODEL', 'inclusionai/ling-2.6-flash'),

  // Dashboard
  dashboardUrl: optionalEnv('DASHBOARD_URL', 'http://localhost:3000'),

  // Logging
  logLevel: optionalEnv('LOG_LEVEL', 'debug'),

  /** Returns the LLM base URL — prefers OpenRouter if key is set */
  get llmBaseUrl(): string {
    if (this.openrouterApiKey) return this.openrouterBaseUrl;
    return 'https://api.openai.com/v1';
  },

  /** Returns the LLM API key — prefers OpenRouter if key is set */
  get llmApiKey(): string {
    if (this.openrouterApiKey) return this.openrouterApiKey;
    return this.openaiApiKey;
  },

  get isDev(): boolean {
    return this.nodeEnv === 'development';
  },
} as const;
