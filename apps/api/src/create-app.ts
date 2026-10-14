import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { timingSafeEqual } from 'node:crypto';
import rateLimit from '@fastify/rate-limit';
import type { FastifyRequest } from 'fastify';
import { Redis } from 'ioredis';
import { AppModule } from './app.module.js';
import { ENV, readEnv, type Env } from './env.js';
import { DEFAULT_BODY, LIMITS } from './limits.js';

/**
 * Builds the app exactly as the server runs it, so tests exercise the same
 * adapter, the same body handling and the same CORS — not a lookalike.
 */
export async function createApp(
  env: Env = readEnv(),
): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.with(env),
    // Small by default; the few routes that need more say so in limits.ts.
    // Behind a load balancer every buyer would otherwise share its IP — and
    // its rate limit. Production sets TRUST_PROXY to the number of hops.
    new FastifyAdapter({
      bodyLimit: DEFAULT_BODY,
      trustProxy: env.TRUST_PROXY || false,
    }),
    {
      // Webhook signatures (Razorpay, Printrove) are HMACs over the exact
      // bytes received. A body parsed to JSON and re-serialised will not
      // match, and the failure is silent: every webhook looks forged. This
      // keeps `req.rawBody` alongside the parsed body (docs/05-lld.md §3).
      rawBody: true,
      bufferLogs: false,
    },
  );
  app.enableCors({
    origin: app.get<Env>(ENV).WEB_ORIGINS,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });
  await applyLimits(app, env);
  app.enableShutdownHooks();
  return app;
}

/**
 * Body and rate limits per route (limits.ts). Must run before init: Nest
 * registers its routes then, and the limits attach as each one is added.
 * Counters live in Redis so they hold across API instances; if Redis is
 * down, requests are let through rather than refused (`skipOnError`) — a
 * lost limit is better than a lost sale.
 */
async function applyLimits(
  app: NestFastifyApplication,
  env: Env,
): Promise<void> {
  const fastify = app.getHttpAdapter().getInstance();
  const unseen = new Set(Object.keys(LIMITS));
  fastify.addHook('onRoute', (route) => {
    for (const method of [route.method].flat()) {
      const key = `${method} ${route.url}`;
      const limit = LIMITS[key];
      if (!limit) continue;
      unseen.delete(key);
      if (limit.body) route.bodyLimit = limit.body;
      if (limit.perMinute && env.RATE_LIMIT === 'on')
        route.config = {
          ...route.config,
          rateLimit: { max: limit.perMinute, timeWindow: 60_000 },
        };
    }
  });
  fastify.addHook('onReady', async () => {
    if (unseen.size)
      throw new Error(
        `limits.ts names routes that do not exist: ${[...unseen].join(', ')}`,
      );
  });
  if (env.RATE_LIMIT === 'off') return;
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1000,
  });
  redis.on('error', () => undefined); // skipOnError carries the request; the log is the 429 that did not happen
  fastify.addHook('onClose', async () => {
    redis.disconnect();
  });
  await app.register(rateLimit, {
    global: false,
    redis,
    nameSpace: `${env.QUEUE_PREFIX}-rl-`,
    skipOnError: true,
    keyGenerator: (req) => clientIp(req, env.BFF_SECRET),
    errorResponseBuilder: (_req, ctx) => ({
      statusCode: 429,
      message: `Too many requests. Try again in ${Math.ceil(ctx.ttl / 1000)} s.`,
    }),
  });
}

/**
 * Who is asking, for rate limits. Web and admin call the API from their own
 * servers, so the socket address is theirs; they forward the buyer's IP with
 * a shared secret (apps/web lib/forwarded.ts). Without the secret, the header
 * is ignored — a direct caller cannot pick its own key.
 */
export function clientIp(req: FastifyRequest, secret: string): string {
  const sent = req.headers['x-bff-secret'];
  const ip = req.headers['x-client-ip'];
  if (typeof sent === 'string' && typeof ip === 'string' && ip) {
    const a = Buffer.from(sent);
    const b = Buffer.from(secret);
    if (a.length === b.length && timingSafeEqual(a, b)) return ip;
  }
  return req.ip;
}
