import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Two questions, two endpoints. `/healthz` — is the process alive — touches
 * nothing, so a Postgres blip never gets a healthy API restarted. `/readyz` —
 * can it do its job — queries, and gates traffic during a rolling deploy.
 */
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('healthz')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readyz')
  async ready(): Promise<{ status: 'ok'; database: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (cause) {
      // 503: nothing is wrong with this code; try another instance.
      throw new HttpException(
        { database: 'unreachable' },
        HttpStatus.SERVICE_UNAVAILABLE,
        {
          cause,
        },
      );
    }
    return { status: 'ok', database: 'ok' };
  }
}
