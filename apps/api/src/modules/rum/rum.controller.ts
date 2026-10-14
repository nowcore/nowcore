import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { RumBeacon } from '@nowcore/shared';
import { PrismaService } from '../../prisma.service.js';

/**
 * Field performance beacons (T-094), forwarded by the storefront's
 * /api/rum. One row per metric, grouped by a beacon id generated here —
 * nothing from the visitor identifies them.
 */
@Controller('rum')
export class RumController {
  constructor(private readonly db: PrismaService) {}

  @Post()
  @HttpCode(204)
  async record(@Body() body: unknown): Promise<void> {
    const r = RumBeacon.safeParse(body);
    if (!r.success) throw new BadRequestException('bad beacon');
    const { route, tier, cores, memory, net, mobile, metrics } = r.data;
    const beacon = randomUUID();
    await this.db.rumSample.createMany({
      data: metrics.map((m) => ({
        beacon,
        route,
        tier,
        metric: m.name,
        value: Math.round(m.value * 1000), // thousandths: the schema has no floats
        cores: cores ?? null,
        memoryMb: memory === undefined ? null : Math.round(memory * 1024),
        net: net ?? null,
        mobile,
      })),
    });
  }
}
