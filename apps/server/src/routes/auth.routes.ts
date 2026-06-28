import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

// Hash the admin password on startup
let adminPasswordHash: string | null = null;

async function ensureAdminHash() {
  if (!adminPasswordHash) {
    adminPasswordHash = await bcrypt.hash(config.adminPassword, 12);
  }
}

export async function authRoutes(app: FastifyInstance) {
  // Initialize admin hash
  await ensureAdminHash();

  /** POST /api/auth/login */
  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Check against admin credentials
    if (email !== config.adminEmail) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const valid = await bcrypt.compare(password, adminPasswordHash!);
    if (!valid) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const accessToken = jwt.sign(
      { email, name: 'Admin' },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    logger.info({ email }, 'User logged in');

    return reply.send({
      success: true,
      data: {
        accessToken,
        user: { email, name: 'Admin' },
      },
    });
  });

  /** GET /api/auth/me — verify token and return user */
  app.get('/api/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      const payload = jwt.verify(authHeader.slice(7), config.jwtSecret) as any;
      return reply.send({
        success: true,
        data: { email: payload.email, name: payload.name },
      });
    } catch {
      return reply.status(401).send({ success: false, error: 'Invalid token' });
    }
  });
}
