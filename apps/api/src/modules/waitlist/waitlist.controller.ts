import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Inject,
  Post,
} from '@nestjs/common';
import { validListToken } from '@nowcore/orders';
import { JoinWaitlist, Unsubscribe } from '@nowcore/shared';
import { ENV, type Env } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';

/**
 * Drop alerts (FR-8, T-083). Joining is idempotent and answers the same
 * whether or not the email was already there, so the endpoint cannot be used
 * to find out who is subscribed. Unsubscribing needs the signed token from an
 * alert email.
 */
@Controller('waitlist')
export class WaitlistController {
  constructor(
    private readonly db: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post()
  @HttpCode(200)
  async join(@Body() body: unknown): Promise<{ ok: true }> {
    const parsed = JoinWaitlist.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Enter an email address.');
    const email = parsed.data.email.trim().toLowerCase();
    await this.db.waitlistSubscription.upsert({
      where: { email },
      create: { email },
      // Signing up again after leaving is a clear request to come back.
      update: { unsubscribedAt: null },
    });
    return { ok: true };
  }

  @Post('unsubscribe')
  @HttpCode(200)
  async leave(@Body() body: unknown): Promise<{ ok: true }> {
    const parsed = Unsubscribe.safeParse(body);
    if (!parsed.success) throw new BadRequestException('bad request');
    const email = parsed.data.email.trim().toLowerCase();
    if (!validListToken(this.env.ORDER_TOKEN_SECRET, email, parsed.data.token))
      throw new ForbiddenException('bad link');
    await this.db.waitlistSubscription.updateMany({
      where: { email, unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    });
    return { ok: true };
  }
}
