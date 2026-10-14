import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Operator } from '@nowcore/db';
import {
  Dashboard,
  Login,
  type AdminOrderDetail,
  type AdminRum,
  type AdminOrderList,
  type Session,
} from '@nowcore/shared';
import { AdminRumService } from './admin-rum.service.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AuthService } from './auth.service.js';
import { OperatorGuard, bearer } from './operator.guard.js';

type Authed = FastifyRequest & { operator: Operator };
const REF = /^[A-Z0-9-]{3,40}$/;
const ref = (r: string) => {
  if (!REF.test(r)) throw new BadRequestException('bad reference');
  return r;
};

@Controller('admin')
export class AdminSessionController {
  constructor(private readonly auth: AuthService) {}

  @Post('session')
  async login(@Body() body: unknown): Promise<Session> {
    const parsed = Login.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Enter an email and a password.');
    const s = await this.auth.login(parsed.data.email, parsed.data.password);
    return {
      token: s.token,
      expiresAt: s.expiresAt.toISOString(),
      operator: s.operator,
    };
  }

  @Delete('session')
  @HttpCode(204)
  async logout(@Req() req: FastifyRequest): Promise<void> {
    await this.auth.logout(bearer(req));
  }
}

/** Every route here requires a live operator session (OperatorGuard). */
@Controller('admin')
@UseGuards(OperatorGuard)
export class AdminController {
  constructor(
    private readonly orders: AdminOrdersService,
    private readonly rum: AdminRumService,
  ) {}

  /** Field performance over the last 1–30 days (T-094). */
  @Get('rum')
  fieldPerformance(@Query('days') days?: string): Promise<AdminRum> {
    const n = Math.min(30, Math.max(1, Number.parseInt(days ?? '7', 10) || 7));
    return this.rum.summary(n);
  }

  @Get('me')
  me(@Req() req: Authed): { email: string; name: string } {
    return { email: req.operator.email, name: req.operator.name };
  }

  @Get('dashboard')
  dashboard(@Query('range') range?: string) {
    return this.orders.dashboard(
      Dashboard.shape.range.catch('today').parse(range),
    );
  }

  @Get('orders')
  list(
    @Query('status') status?: string,
    @Query('q') q?: string,
  ): Promise<AdminOrderList> {
    return this.orders.list(status, q?.slice(0, 80));
  }

  @Get('orders/:reference')
  detail(@Param('reference') r: string): Promise<AdminOrderDetail> {
    return this.orders.detail(ref(r));
  }

  @Post('orders/:reference/retry')
  @HttpCode(204)
  retry(@Param('reference') r: string, @Req() req: Authed): Promise<void> {
    return this.orders.retry(ref(r), req.operator.email);
  }

  @Post('orders/:reference/cancel')
  @HttpCode(204)
  cancel(@Param('reference') r: string, @Req() req: Authed): Promise<void> {
    return this.orders.cancel(ref(r), req.operator.email);
  }

  @Post('orders/:reference/refund')
  @HttpCode(204)
  refund(
    @Param('reference') r: string,
    @Req() req: Authed,
    @Body() body: { note?: unknown },
  ): Promise<void> {
    return this.orders.refund(
      ref(r),
      req.operator.email,
      typeof body?.note === 'string' ? body.note : '',
    );
  }
}
