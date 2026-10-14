import { Injectable } from '@nestjs/common';
import { Prisma } from '@nowcore/db';
import { RumMetric, type AdminRum } from '@nowcore/shared';
import { PrismaService } from '../../prisma.service.js';

/**
 * The field-performance summary (T-094). Vitals at p75, as CrUX reports
 * them. Scroll is different: each page view sends its 95th-percentile frame
 * time (the NFR-2 measure), and the table shows the p75 of those across page
 * views, as frames per second — "three visits in four scrolled at least this
 * smoothly for 95% of frames".
 */
@Injectable()
export class AdminRumService {
  constructor(private readonly db: PrismaService) {}

  async summary(days: number): Promise<AdminRum> {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.db.$queryRaw<
      { metric: string; seg: string; n: bigint; p75: number | null }[]
    >(Prisma.sql`
      SELECT metric, seg, count(*) AS n,
             percentile_cont(0.75) WITHIN GROUP (ORDER BY value) / 1000.0 AS p75
      FROM (
        -- value is stored in thousandths of its unit
        SELECT metric, value, 'all' AS seg FROM rum_samples WHERE created_at >= ${since}
        UNION ALL
        SELECT metric, value, 'low-end' FROM rum_samples
          WHERE created_at >= ${since} AND (cores <= 4 OR memory_mb <= 4096)
        UNION ALL
        SELECT metric, value, tier FROM rum_samples WHERE created_at >= ${since}
      ) s
      GROUP BY metric, seg`);
    const [{ views }] = await this.db.$queryRaw<[{ views: bigint }]>(
      Prisma.sql`SELECT count(DISTINCT beacon) AS views FROM rum_samples WHERE created_at >= ${since}`,
    );
    const table: AdminRum['table'] = {};
    for (const r of rows) {
      const metric = RumMetric.safeParse(r.metric);
      if (!metric.success) continue;
      const v =
        r.p75 === null
          ? null
          : metric.data === 'SCROLL_FT95'
            ? Math.round(1000 / Math.max(r.p75, 1))
            : metric.data === 'CLS'
              ? Math.round(r.p75 * 1000) / 1000
              : Math.round(r.p75);
      (table[metric.data] ??= {})[r.seg] = { samples: Number(r.n), value: v };
    }
    return { days, pageViews: Number(views), table };
  }
}
