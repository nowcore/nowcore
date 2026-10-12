import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

/**
 * A standalone Nest context: no HTTP server, only queue consumers.
 *
 * Shutdown hooks matter more here than in the API. On SIGTERM BullMQ stops
 * taking new jobs and lets the active one finish; without the hook a deploy
 * kills a POD submission half-sent, and the retry may double-order.
 */
const app = await NestFactory.createApplicationContext(WorkerModule.with());
app.enableShutdownHooks();
new Logger('bootstrap').log('worker started');
