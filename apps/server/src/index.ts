import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { authRoutes } from './routes/auth.routes.js';
import { callRoutes } from './routes/calls.routes.js';
import { promptRoutes } from './routes/prompts.routes.js';
import { registerDashboardWs } from './ws/dashboard-ws.js';
import { startVoiceServer } from './voice-app/server.js';

async function main() {
  const app = Fastify({
    logger: false, // We use our own Pino instance
  });

  // ─── Plugins ────────────────────────────────────────────────
  await app.register(cors, {
    origin: [config.dashboardUrl, 'http://localhost:3000'],
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Parse URL-encoded bodies (Twilio sends form data)
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (req, body, done) => {
      try {
        const parsed = Object.fromEntries(new URLSearchParams(body as string));
        done(null, parsed);
      } catch (err: any) {
        done(err);
      }
    }
  );

  await app.register(websocket);

  // ─── Routes ─────────────────────────────────────────────────
  await app.register(authRoutes);
  await app.register(callRoutes);
  await app.register(promptRoutes);
  // ─── WebSocket Endpoints ────────────────────────────────────
  await app.register(registerDashboardWs);

  // Start Fonoster Voice Server
  startVoiceServer(config.fonosterVoicePort);

  // ─── Health Check ───────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  // ─── Settings / Provider Status ─────────────────────────────
  app.get('/api/settings/status', async () => {
    const providers = [
      {
        name: 'Fonoster',
        status: config.fonosterAccessKeyId ? 'connected' : 'unconfigured',
        details: `Endpoint: ${config.fonosterEndpoint}`,
      },
      {
        name: 'Cellhub (SIP)',
        status: config.cellhubCallerId ? 'connected' : 'unconfigured',
        details: `Caller ID: ${config.cellhubCallerId}`,
      },
      {
        name: 'Deepgram',
        status: config.deepgramApiKey ? 'connected' : 'unconfigured',
        details: 'Nova-2 STT',
      },
      {
        name: 'ElevenLabs',
        status: config.elevenlabsApiKey ? 'connected' : 'unconfigured',
        details: `Voice: ${config.elevenlabsVoiceId}`,
      },
      {
        name: 'LLM (OpenRouter)',
        status: config.llmApiKey ? 'connected' : 'unconfigured',
        details: config.defaultLlmModel,
      },
    ];
    return { success: true, data: providers };
  });

  // ─── Global Error Handler ──────────────────────────────────
  app.setErrorHandler((error: any, _request, reply) => {
    logger.error({ err: error }, 'Unhandled error');
    reply.status(error.statusCode || 500).send({
      success: false,
      error: config.isDev ? error.message : 'Internal server error',
    });
  });

  // ─── Start Server ──────────────────────────────────────────
  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info(`
╔══════════════════════════════════════════════════════╗
║              VoxPilot Server v0.1.0                  ║
╠══════════════════════════════════════════════════════╣
║  API:        http://${config.host}:${config.port}              ║
║  Dashboard:  ${config.dashboardUrl.padEnd(38)}║
║  Voice Port: ${String(config.fonosterVoicePort).padEnd(38)}║
║  LLM:        ${config.defaultLlmModel.padEnd(38)}║
║  Mode:       ${config.nodeEnv.padEnd(38)}║
╚══════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

main();
