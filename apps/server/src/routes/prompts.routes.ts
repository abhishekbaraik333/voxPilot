import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import * as store from '../services/call-store.js';

export async function promptRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  /** GET /api/prompts */
  app.get('/api/prompts', async (_request, reply) => {
    return reply.send({ success: true, data: store.getAllPrompts() });
  });

  /** GET /api/prompts/:id */
  app.get('/api/prompts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prompt = store.getPrompt(id);
    if (!prompt) {
      return reply.status(404).send({ success: false, error: 'Prompt not found' });
    }
    return reply.send({ success: true, data: prompt });
  });

  /** POST /api/prompts */
  app.post('/api/prompts', async (request, reply) => {
    const { name, description, systemPrompt, tone } = request.body as any;

    if (!name || !systemPrompt) {
      return reply.status(400).send({
        success: false,
        error: 'name and systemPrompt are required',
      });
    }

    const prompt = store.createPrompt({ name, description, systemPrompt, tone });
    return reply.status(201).send({ success: true, data: prompt });
  });

  /** PUT /api/prompts/:id */
  app.put('/api/prompts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    const prompt = store.updatePrompt(id, updates);
    if (!prompt) {
      return reply.status(404).send({ success: false, error: 'Prompt not found' });
    }

    return reply.send({ success: true, data: prompt });
  });

  /** DELETE /api/prompts/:id */
  app.delete('/api/prompts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = store.deletePrompt(id);

    if (!deleted) {
      return reply.status(404).send({ success: false, error: 'Prompt not found' });
    }

    return reply.send({ success: true });
  });
}
