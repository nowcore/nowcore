import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  CreateDrop,
  DecideTrend,
  PromoteTrend,
  type AdminRadar,
  UpdateDrop,
  UpdateVariant,
  type AdminCustomer,
  type AdminDropDetail,
  type AdminDropRow,
} from '@nowcore/shared';
import { AdminDropsService } from './admin-drops.service.js';
import { AdminTrendsService } from './admin-trends.service.js';
import { OperatorGuard } from './operator.guard.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slug = (s: string) => {
  if (!SLUG.test(s) || s.length > 60) throw new BadRequestException('bad slug');
  return s;
};
function parse<T>(
  schema: {
    safeParse(v: unknown):
      | { success: true; data: T }
      | {
          success: false;
          error: { issues: { path: PropertyKey[]; message: string }[] };
        };
  },
  body: unknown,
): T {
  const r = schema.safeParse(body);
  if (r.success) return r.data;
  throw new BadRequestException({
    message: 'Check the highlighted fields.',
    fields: Object.fromEntries(
      r.error.issues.map((i) => [i.path.join('.'), i.message]),
    ),
  });
}

/** Drop authoring and the publish check. Every route needs a live operator session. */
@Controller('admin')
@UseGuards(OperatorGuard)
export class AdminDropsController {
  constructor(
    private readonly drops: AdminDropsService,
    private readonly trends: AdminTrendsService,
  ) {}

  @Get('trends')
  radar(): Promise<AdminRadar> {
    return this.trends.board();
  }

  @Post('trends/decide')
  @HttpCode(204)
  decide(@Body() body: unknown): Promise<void> {
    return this.trends.decide(parse(DecideTrend, body));
  }

  @Post('trends/promote')
  promote(@Body() body: unknown): Promise<{ slug: string }> {
    return this.trends.promote(parse(PromoteTrend, body).key);
  }

  @Get('drops')
  list(): Promise<AdminDropRow[]> {
    return this.drops.list();
  }

  @Post('drops')
  create(@Body() body: unknown): Promise<{ slug: string }> {
    return this.drops.create(parse(CreateDrop, body));
  }

  @Get('drops/:slug')
  detail(@Param('slug') s: string): Promise<AdminDropDetail> {
    return this.drops.detail(slug(s));
  }

  @Patch('drops/:slug')
  @HttpCode(204)
  update(@Param('slug') s: string, @Body() body: unknown): Promise<void> {
    return this.drops.update(slug(s), parse(UpdateDrop, body));
  }

  @Put('drops/:slug/chapters')
  @HttpCode(204)
  chapters(@Param('slug') s: string, @Body() body: unknown): Promise<void> {
    return this.drops.setChapters(slug(s), body);
  }

  @Post('drops/:slug/artwork')
  artwork(
    @Param('slug') s: string,
    @Body() body: { pngBase64?: unknown },
  ): Promise<{ jobs: number }> {
    if (typeof body?.pngBase64 !== 'string')
      throw new BadRequestException('Send the artwork as pngBase64.');
    return this.drops.uploadArtwork(slug(s), body.pngBase64);
  }

  @Post('drops/:slug/publish')
  @HttpCode(204)
  publish(
    @Param('slug') s: string,
    @Body() body: { mode?: unknown },
  ): Promise<void> {
    if (body?.mode !== 'now' && body?.mode !== 'schedule')
      throw new BadRequestException('mode is now or schedule');
    return this.drops.publish(slug(s), body.mode);
  }

  @Post('drops/:slug/close')
  @HttpCode(204)
  close(@Param('slug') s: string): Promise<void> {
    return this.drops.close(slug(s));
  }

  @Post('drops/:slug/extend')
  @HttpCode(204)
  extend(
    @Param('slug') s: string,
    @Body() body: { hours?: unknown },
  ): Promise<void> {
    return this.drops.extend(slug(s), Number(body?.hours));
  }

  @Patch('variants/:sku')
  @HttpCode(204)
  variant(@Param('sku') sku: string, @Body() body: unknown): Promise<void> {
    if (!/^NC-\d{3}-[A-Z]+-[A-Z]+-[A-Z0-9]+$/.test(sku))
      throw new BadRequestException('bad sku');
    return this.drops.updateVariant(sku, parse(UpdateVariant, body));
  }

  @Get('customers')
  customers(): Promise<AdminCustomer[]> {
    return this.drops.customers();
  }
}
