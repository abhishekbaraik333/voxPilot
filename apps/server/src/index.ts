import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { authRoutes } from './routes/auth.routes.js';
import { callRoutes } from './routes/calls.routes.js';
import { promptRoutes } from './routes/prompts.routes.js';
import { webhookRoutes } from './routes/webhooks.routes.js';
import { handleDashboardWsConnection } from './ws/dashboard-ws.js';
import { handleTwilioStreamConnection } from './ws/twilio-stream.js';

async function main() {
  const app = Fastify({
    logger: false, // We use our own Pino instance
  });

  // ─── Plugins ────────────────────────────────────────────────
  await app.register(cors, {
    origin: true,
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

  // ─── Routes ─────────────────────────────────────────────────
  await app.register(authRoutes);
  await app.register(callRoutes);
  await app.register(promptRoutes);
  await app.register(webhookRoutes);

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
        name: 'Twilio',
        status: config.twilioAccountSid?.startsWith('AC') ? 'connected' : 'unconfigured',
        details: config.twilioPhoneNumber,
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

  // ─── WebSocket Upgrade Handling (Native ws Server) ──────────
  const twilioWss = new WebSocketServer({ noServer: true });
  twilioWss.on('connection', (ws, req) => {
    handleTwilioStreamConnection(ws, req);
  });

  const dashboardWss = new WebSocketServer({ noServer: true });
  dashboardWss.on('connection', (ws, req) => {
    handleDashboardWsConnection(ws, req);
  });

  app.server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`).pathname;
    logger.info({ pathname, url: request.url }, 'Incoming WebSocket upgrade request');

    if (pathname === '/ws/twilio-stream' || pathname.startsWith('/ws/twilio-stream')) {
      twilioWss.handleUpgrade(request, socket, head, (ws) => {
        twilioWss.emit('connection', ws, request);
      });
    } else if (pathname === '/ws/dashboard' || pathname.startsWith('/ws/dashboard')) {
      dashboardWss.handleUpgrade(request, socket, head, (ws) => {
        dashboardWss.emit('connection', ws, request);
      });
    } else {
      logger.warn({ pathname }, 'Unrecognized WebSocket path — closing connection');
      socket.destroy();
    }
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
║  Webhooks:   ${config.twilioWebhookBaseUrl.padEnd(38)}║
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
