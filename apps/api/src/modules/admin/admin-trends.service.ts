import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  radar,
  TrendSource,
  type AdminRadar,
  type DecideTrend,
  type RadarCluster,
} from '@nowcore/shared';
import { SIGNAL } from '@nowcore/shared/color';
import { PrismaService } from '../../prisma.service.js';
import { AdminDropsService } from './admin-drops.service.js';

const DAY = 24 * 3_600_000;

/** "gemini argon" → "gemini-argon"; a key in another script has no Latin slug, so it gets the drop's number. */
function slugFor(key: string, number: number): string {
  const s = key
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return s ? `${s}-${number}` : `radar-${number}`;
}

/**
 * The trend radar board (T-079–T-081). Clusters are computed from the last
 * 24 h of trends on every read — the decisions are the only state kept.
 */
@Injectable()
export class AdminTrendsService {
  constructor(
    private readonly db: PrismaService,
    private readonly drops: AdminDropsService,
  ) {}

  private async clusters(now: Date): Promise<RadarCluster[]> {
    const trends = await this.db.trend.findMany({
      where: { seenAt: { gte: new Date(now.getTime() - DAY) } },
    });
    return radar(
      trends.map((t) => ({ ...t, source: TrendSource.parse(t.source) })),
      now,
    );
  }

  async board(now = new Date()): Promise<AdminRadar> {
    const clusters = await this.clusters(now);
    const decisions = new Map(
      (
        await this.db.trendCluster.findMany({
          where: { key: { in: clusters.map((c) => c.key) } },
          include: { drop: { select: { slug: true } } },
        })
      ).map((d) => [d.key, d]),
    );
    const onBoard = new Set(clusters.flatMap((c) => c.trendIds));
    const watch = await this.db.trend.findMany({
      where: {
        seenAt: { gte: new Date(now.getTime() - DAY) },
        id: { notIn: [...onBoard] },
      },
      orderBy: { score: 'desc' },
      take: 15,
    });
    const last = await this.db.trend.groupBy({
      by: ['source'],
      _max: { seenAt: true },
    });
    return {
      rows: clusters.map((c) => ({
        key: c.key,
        heat: c.heat,
        sources: c.sources.map(({ source, term, score, url }) => ({
          source,
          term,
          score,
          url,
        })),
        status: decisions.get(c.key)?.status ?? 'NEW',
        dropSlug: decisions.get(c.key)?.drop?.slug ?? null,
      })),
      watch: watch.map((t) => ({
        source: TrendSource.parse(t.source),
        term: t.term,
        score: t.score,
        url: t.url,
        seenAt: t.seenAt.toISOString(),
      })),
      sources: TrendSource.options.map((source) => ({
        source,
        lastSeenAt:
          last.find((l) => l.source === source)?._max.seenAt?.toISOString() ??
          null,
      })),
    };
  }

  private async onBoard(key: string, now: Date): Promise<RadarCluster> {
    const c = (await this.clusters(now)).find((x) => x.key === key);
    if (!c)
      throw new NotFoundException(
        'That signal is not on the board — it needs two sources above the line in the last 24 hours.',
      );
    return c;
  }

  async decide({ key, action }: DecideTrend, now = new Date()): Promise<void> {
    const existing = await this.db.trendCluster.findUnique({ where: { key } });
    if (existing?.status === 'SHIPPED')
      throw new ConflictException('That signal is already a drop.');
    if (action === 'reset') {
      await this.db.trendCluster.deleteMany({ where: { key } });
      return;
    }
    await this.onBoard(key, now);
    const status = action === 'shortlist' ? 'SHORTLISTED' : 'REJECTED';
    await this.db.trendCluster.upsert({
      where: { key },
      create: { key, status },
      update: { status, decidedAt: now },
    });
  }

  /**
   * Promote a signal to a draft drop (T-081). The two-source rule is enforced
   * here, not only on the board: the drop is created from defaults the
   * operator then edits, and every trend under the key is linked to it as the
   * evidence FR-23 asks every drop to carry.
   */
  async promote(key: string, now = new Date()): Promise<{ slug: string }> {
    const c = await this.onBoard(key, now);
    const decided = await this.db.trendCluster.findUnique({ where: { key } });
    if (decided?.status === 'SHIPPED')
      throw new ConflictException('That signal is already a drop.');
    const number =
      ((await this.db.drop.aggregate({ _max: { number: true } }))._max.number ??
        0) + 1;
    const title = key.replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
    const { slug } = await this.drops.create({
      number,
      slug: slugFor(key, number),
      title: title.length >= 2 ? title.slice(0, 60) : `Drop ${number}`,
      accentColor: SIGNAL, // the house accent until the operator picks the drop's own
      editionSize: null,
      colourways: ['blk'],
      pricePaise: 79900,
      description:
        `From the radar: ${c.sources.map((s) => `${s.term} (${s.source} ${s.score})`).join('; ')}`.slice(
          0,
          600,
        ),
    });
    const drop = await this.db.drop.findUniqueOrThrow({ where: { slug } });
    await this.db.$transaction([
      this.db.trendCluster.upsert({
        where: { key },
        create: { key, status: 'SHIPPED', dropId: drop.id },
        update: { status: 'SHIPPED', dropId: drop.id, decidedAt: now },
      }),
      this.db.trend.updateMany({
        where: { id: { in: c.trendIds } },
        data: { status: 'SHIPPED', dropId: drop.id },
      }),
    ]);
    return { slug };
  }
}
