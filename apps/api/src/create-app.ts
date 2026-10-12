import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { ENV, readEnv, type Env } from './env.js';

/**
 * Builds the app exactly as the server runs it, so tests exercise the same
 * adapter, the same body handling and the same CORS — not a lookalike.
 */
export async function createApp(
  env: Env = readEnv(),
): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.with(env),
    new FastifyAdapter(),
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
  app.enableShutdownHooks();
  return app;
}
