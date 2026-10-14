import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ENV, type Env } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';
import { AdminDropsService, withProduct } from './admin-drops.service.js';

/**
 * The drop clock (T-082). Every minute: close live drops whose time is up,
 * then open the earliest scheduled drop that is due.
 *
 * In the API, not the worker, because opening must pass the same publish
 * check an operator's "open now" does — a scheduled drop can still be edited,
 * and only the API can ask the printer about its variants. A due drop that
 * fails the check, or that waits behind a live one, stays scheduled; the
 * admin shows why. Safe on several instances: opening is locked, closing is
 * conditional on the drop still being live.
 */
@Injectable()
export class DropClockService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('drop-clock');
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly db: PrismaService,
    private readonly drops: AdminDropsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    if (this.env.DROP_CLOCK === 'off') return;
    this.timer = setInterval(
      () => void this.tick().catch((e: unknown) => this.log.error(e)),
      60_000,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<{
    closed: number[];
    opened: number[];
    held: Record<number, 'check' | 'live'>;
  }> {
    const closed: number[] = [];
    const expired = await this.db.drop.findMany({
      where: { status: 'LIVE', closesAt: { lte: now } },
    });
    for (const d of expired) {
      const { count } = await this.db.drop.updateMany({
        where: { id: d.id, status: 'LIVE' },
        data: { status: 'ARCHIVED' },
      });
      if (count) closed.push(d.number);
    }
    if (closed.length) this.drops.refreshStorefront();

    const opened: number[] = [];
    const held: Record<number, 'check' | 'live'> = {};
    const due = await this.db.drop.findMany({
      where: { status: 'SCHEDULED', opensAt: { lte: now } },
      include: withProduct,
      orderBy: { opensAt: 'asc' },
    });
    for (const d of due) {
      const problems = await this.drops.problems(d);
      if (problems.length) {
        this.log.warn(
          `drop ${d.number} is due but cannot open: ${problems.join(' ')}`,
        );
        held[d.number] = 'check';
        continue;
      }
      if ((await this.drops.open(d, now)) === true) opened.push(d.number);
      else held[d.number] = 'live';
      break; // one live drop at a time: the rest wait for the next close
    }
    if (closed.length || opened.length)
      this.log.log(
        `closed [${closed.join(', ')}] opened [${opened.join(', ')}]`,
      );
    return { closed, opened, held };
  }
}
