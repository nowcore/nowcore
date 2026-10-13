import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@nowcore/db';
import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { WORKER_ENV } from './tokens.js';
import type { Env } from './env.js';

/**
 * The worker's own connection. Boot proves the database answers — with
 * Prisma 7's driver adapter `$connect()` opens nothing, and a worker that
 * could not reach Postgres would otherwise accept jobs and fail every one.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(@Inject(WORKER_ENV) env: Env) {
    super({ adapter: new PrismaPg(env.DATABASE_URL) });
  }
  async onModuleInit(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
