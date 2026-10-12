import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@nowcore/db';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ENV, type Env } from './env.js';

/**
 * The database, owned by the process with a connection pool (ADR-003: the API
 * is the only writer).
 *
 * Boot proves the database answers by querying it. `$connect()` alone is not
 * enough: with Prisma 7's driver adapter it opens nothing, and an API pointed
 * at a database that does not exist booted cleanly and failed on the first
 * buyer's request instead (caught by api.spec.ts, 13 Oct 2026).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly log = new Logger('prisma');

  constructor(@Inject(ENV) env: Env) {
    super({ adapter: new PrismaPg(env.DATABASE_URL) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.$queryRaw`SELECT 1`;
    this.log.log('connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
