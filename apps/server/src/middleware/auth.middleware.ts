import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

interface JwtPayload {
  email: string;
  name: string;
}

/** Extract and verify JWT from Authorization header */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    // Attach user to request
    (request as any).user = payload;
  } catch (err) {
    logger.warn({ err }, 'JWT verification failed');
    return reply.status(401).send({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}
