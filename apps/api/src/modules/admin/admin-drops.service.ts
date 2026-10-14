import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Prisma } from '@nowcore/db';
import type { PodProvider } from '@nowcore/pod';
import {
  accentProblems,
  BLANK_SIZES,
  BLANKS,
  canDropTransition,
  ChapterKey,
  Chapters,
  makeSku,
  QUEUE,
  type AdminCustomer,
  type AdminDropDetail,
  type AdminDropRow,
  type CreateDrop,
  type RenderJob,
  type Size,
  type UpdateDrop,
  UpdateVariant,
} from '@nowcore/shared';
import type { z } from 'zod';
import { ENV, type Env } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';
import { POD_PROVIDER } from '../fulfilment/pod.module.js';
import { assetUrl } from '../assets/asset-url.js';

const CLAIMED = [
  'PAID',
  'FULFILMENT_QUEUED',
  'FULFILMENT_FAILED',
  'PRINTING',
  'SHIPPED',
  'DELIVERED',
] as const;
const MAX_ARTWORK = 8 * 1024 * 1024;
const MIN_ARTWORK_PX = 600;

const withProduct = {
  products: { include: { variants: true, assets: true } },
} satisfies Prisma.DropInclude;
type DropRow = Prisma.DropGetPayload<{ include: typeof withProduct }>;

/** A first draft of the film's copy, so a new drop is never blank. The operator rewrites it. */
function draftChapters(title: string, number: number) {
  const label = `Drop ${String(number).padStart(3, '0')}`;
  const words = title.split(' ');
  const one = words.length > 1 ? words.slice(0, -1).join(' ') : title;
  const two = `${words.length > 1 ? words.at(-1) : 'now'}.`.toLowerCase();
  const copy: Record<string, [string, string, string]> = {
    'the-signal': [`${label} — ${title}`, 'Wear the', 'moment.'],
    'whats-now': ["01 / What's now", 'The internet,', 'right now.'],
    'the-drop': ['02 / The drop', one, two],
    'the-archive': ['03 / The archive', 'Here,', 'then gone.'],
    'the-making': ['04 / The making', 'Spotted at nine.', 'Shipping by six.'],
    'the-wall': ['05 / The wall', 'Worn by', 'the timeline.'],
    'take-it': ['06 / Take it', 'Never miss', 'a drop.'],
  };
  return ChapterKey.options.map((key) => {
    const [kicker, lineOne, lineTwo] = copy[key] as [string, string, string];
    return { key, kicker, lineOne, lineTwo };
  });
}

/** The drops side of the admin (T-064–T-068, T-072, T-073). */
@Injectable()
export class AdminDropsService implements OnModuleDestroy {
  private readonly render: Queue<RenderJob>;

  constructor(
    private readonly db: PrismaService,
    @Inject(POD_PROVIDER) private readonly pod: PodProvider,
    @Inject(ENV) private readonly env: Env,
  ) {
    const u = new URL(env.REDIS_URL);
    this.render = new Queue(QUEUE.render, {
      connection: { host: u.hostname, port: Number(u.port || 6379) },
      prefix: env.QUEUE_PREFIX,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.render.close();
  }

  /**
   * Tell the storefront its catalogue changed. Best effort, and never awaited
   * by the caller's outcome: the storefront being down must not stop an
   * operator closing a drop. Its own 30 s cache is the fallback.
   */
  private refreshStorefront(): void {
    void fetch(this.env.WEB_REVALIDATE_URL, {
      method: 'POST',
      headers: { 'x-revalidate-secret': this.env.REVALIDATE_SECRET },
      signal: AbortSignal.timeout(3000),
    }).catch(() => undefined);
  }

  async list(): Promise<AdminDropRow[]> {
    const drops = await this.db.drop.findMany({
      include: withProduct,
      orderBy: { number: 'desc' },
    });
    return Promise.all(
      drops.map(async (d) => ({
        ...(await this.row(d)),
        // Only a drop that could still open has problems worth counting.
        problems:
          d.status === 'DRAFT' || d.status === 'SCHEDULED'
            ? (await this.problems(d)).length
            : 0,
      })),
    );
  }

  async detail(slug: string): Promise<AdminDropDetail> {
    const d = await this.must(slug);
    const problemList =
      d.status === 'DRAFT' || d.status === 'SCHEDULED'
        ? await this.problems(d)
        : [];
    const p = d.products[0];
    return {
      ...(await this.row(d)),
      problems: problemList.length,
      problemList,
      chapters: Chapters.safeParse(d.chapters).success
        ? Chapters.parse(d.chapters)
        : [],
      product: p
        ? {
            slug: p.slug,
            title: p.title,
            description: p.description,
            hasArtwork: p.assets.some((a) => a.kind === 'artwork'),
          }
        : null,
      variants: (p?.variants ?? [])
        .sort((a, b) => a.sku.localeCompare(b.sku))
        .map((v) => ({
          sku: v.sku,
          size: v.size,
          colourName: v.colorName,
          pricePaise: v.pricePaise,
          soldOut: v.soldOut,
          podVariantId: v.podVariantId,
          still: assetUrl(this.env.ASSET_BASE_URL, v.mockupUrl),
          rendered: !!v.sequenceUrl && !!v.mockupUrl,
        })),
    };
  }

  async create(input: CreateDrop): Promise<{ slug: string }> {
    const clash = await this.db.drop.findFirst({
      where: { OR: [{ number: input.number }, { slug: input.slug }] },
    });
    if (clash)
      throw new ConflictException(
        clash.number === input.number
          ? `Drop ${input.number} exists.`
          : `The slug ${input.slug} is taken.`,
      );
    const blanks = BLANKS.filter((b) => input.colourways.includes(b.code));
    await this.db.drop.create({
      data: {
        number: input.number,
        slug: input.slug,
        title: input.title,
        accentColor: input.accentColor.toUpperCase(),
        editionSize: input.editionSize,
        chapters: draftChapters(input.title, input.number),
        products: {
          create: {
            slug: `${input.slug}-tee`,
            title: input.title,
            description: input.description,
            basePaise: input.pricePaise,
            variants: {
              create: blanks.flatMap((b) =>
                BLANK_SIZES.map((size) => ({
                  size,
                  colorName: b.name,
                  colorHex: b.hex,
                  sku: makeSku({
                    drop: input.number,
                    garment: 'TEE',
                    color: b.code,
                    size: size as Size,
                  }),
                  // 2XL and up cost the printer more.
                  pricePaise:
                    size.startsWith('2') || size.startsWith('3')
                      ? input.pricePaise + 5000
                      : input.pricePaise,
                })),
              ),
            },
          },
        },
      },
    });
    return { slug: input.slug };
  }

  async update(slug: string, input: UpdateDrop): Promise<void> {
    const d = await this.must(slug);
    if (d.status === 'ARCHIVED')
      throw new ConflictException(
        'An archived drop is history; it cannot be edited.',
      );
    if (
      d.status === 'LIVE' &&
      (input.accentColor ||
        input.opensAt !== undefined ||
        input.editionSize !== undefined)
    ) {
      throw new ConflictException(
        'A live drop keeps its accent, opening and edition. Use close or extend for its window.',
      );
    }
    await this.db.drop.update({
      where: { id: d.id },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.accentColor
          ? { accentColor: input.accentColor.toUpperCase() }
          : {}),
        ...(input.editionSize !== undefined
          ? { editionSize: input.editionSize }
          : {}),
        ...(input.opensAt !== undefined
          ? { opensAt: input.opensAt ? new Date(input.opensAt) : null }
          : {}),
        ...(input.closesAt !== undefined && d.status !== 'LIVE'
          ? { closesAt: input.closesAt ? new Date(input.closesAt) : null }
          : {}),
      },
    });
    if (input.description && d.products[0]) {
      await this.db.product.update({
        where: { id: d.products[0].id },
        data: { description: input.description },
      });
    }
  }

  async setChapters(slug: string, chapters: unknown): Promise<void> {
    const d = await this.must(slug);
    const parsed = Chapters.safeParse(chapters);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      );
    await this.db.drop.update({
      where: { id: d.id },
      data: { chapters: parsed.data },
    });
  }

  async updateVariant(
    sku: string,
    input: z.infer<typeof UpdateVariant>,
  ): Promise<void> {
    const v = await this.db.variant.findUnique({ where: { sku } });
    if (!v) throw new NotFoundException('no such variant');
    await this.db.variant.update({
      where: { sku },
      data: {
        ...(input.podVariantId !== undefined
          ? { podVariantId: input.podVariantId || null }
          : {}),
        ...(input.pricePaise !== undefined
          ? { pricePaise: input.pricePaise }
          : {}),
        ...(input.soldOut !== undefined ? { soldOut: input.soldOut } : {}),
      },
    });
  }

  /**
   * Artwork → a render job per colourway (T-066). Checked before anything is
   * stored: a PNG by its magic bytes (not its name), under 8 MB, at least
   * 600 px on its shorter side. Only before opening: re-rendering a live drop
   * would blank its turntables while buyers are looking.
   */
  async uploadArtwork(
    slug: string,
    pngBase64: string,
  ): Promise<{ jobs: number }> {
    const d = await this.must(slug);
    if (d.status === 'LIVE' || d.status === 'ARCHIVED')
      throw new ConflictException('Artwork is set before a drop opens.');
    const product = d.products[0];
    if (!product) throw new ConflictException('This drop has no product.');

    const bytes = Buffer.from(pngBase64, 'base64');
    if (bytes.length > MAX_ARTWORK)
      throw new BadRequestException('Artwork must be under 8 MB.');
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG))
      throw new BadRequestException('Artwork must be a PNG.');
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (Math.min(width, height) < MIN_ARTWORK_PX) {
      throw new BadRequestException(
        `Artwork is ${width}×${height}; it needs at least ${MIN_ARTWORK_PX} px on each side to print cleanly.`,
      );
    }

    const rev = randomBytes(5).toString('hex').slice(0, 8);
    const key = `artwork/${slug}/${rev}.png`;
    const path = join(this.env.STORAGE_DIR, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    await this.db.asset.create({
      data: {
        productId: product.id,
        kind: 'artwork',
        path: key,
        bytes: bytes.length,
      },
    });
    // Not rendered until the worker says so: the publish check reads this.
    await this.db.variant.updateMany({
      where: { productId: product.id },
      data: { sequenceUrl: null, mockupUrl: null },
    });

    const colourways = [
      ...new Map(product.variants.map((v) => [v.colorName, v])).values(),
    ];
    for (const v of colourways) {
      const code =
        BLANKS.find((b) => b.name === v.colorName)?.code ??
        v.sku.split('-')[3]?.toLowerCase() ??
        'blk';
      await this.render.add(
        'turntable',
        {
          productId: product.id,
          drop: slug,
          colourCode: code,
          colourName: v.colorName,
          garmentHex: v.colorHex,
          artworkKey: key,
          rev,
        },
        {
          jobId: `render-${product.id}-${code}-${rev}`,
          attempts: 2,
          removeOnComplete: 100,
          removeOnFail: false,
        },
      );
    }
    return { jobs: colourways.length };
  }

  /** The publish check (T-068, docs/05 §5). Every reason a drop cannot open, in words. */
  async problems(d: DropRow): Promise<string[]> {
    const out: string[] = [];
    const product = d.products[0];
    const variants = product?.variants ?? [];
    if (!product || variants.length === 0)
      out.push('There is no product with variants.');

    const unmapped = variants.filter((v) => !v.podVariantId).map((v) => v.sku);
    if (unmapped.length)
      out.push(
        `${unmapped.length} variant(s) are not mapped to the printer: ${unmapped.slice(0, 4).join(', ')}${unmapped.length > 4 ? '…' : ''}`,
      );
    const mapped = variants.flatMap((v) =>
      v.podVariantId ? [v.podVariantId] : [],
    );
    if (mapped.length) {
      const unknown = await this.pod.unknownVariants(mapped);
      if (unknown.length)
        out.push(
          `The printer does not stock ${unknown.length} mapped id(s): ${unknown.slice(0, 4).join(', ')}`,
        );
    }

    const unrendered = [
      ...new Set(
        variants
          .filter((v) => !v.sequenceUrl || !v.mockupUrl)
          .map((v) => v.colorName),
      ),
    ];
    if (unrendered.length)
      out.push(
        `No turntable yet for: ${unrendered.join(', ')}. Upload artwork and wait for the render.`,
      );

    for (const p of accentProblems(d.accentColor))
      out.push(`Accent ${d.accentColor}: ${p}.`);
    if (!Chapters.safeParse(d.chapters).success)
      out.push(
        'The film copy is incomplete — all seven chapters need a kicker and two lines.',
      );
    if (d.opensAt && d.closesAt && d.closesAt <= d.opensAt)
      out.push('It closes before it opens.');
    return out;
  }

  async publish(
    slug: string,
    mode: 'now' | 'schedule',
    now = new Date(),
  ): Promise<void> {
    const d = await this.must(slug);
    const to = mode === 'now' ? 'LIVE' : 'SCHEDULED';
    if (!canDropTransition(d.status, to))
      throw new ConflictException(
        `A ${d.status.toLowerCase()} drop cannot be ${mode === 'now' ? 'opened' : 'scheduled'}.`,
      );
    const problems = await this.problems(d);
    if (problems.length)
      throw new ConflictException({
        message: 'This drop cannot open yet.',
        problems,
      });

    if (mode === 'schedule') {
      if (!d.opensAt || d.opensAt <= now)
        throw new ConflictException(
          'Set an opening time in the future to schedule.',
        );
      await this.db.drop.update({
        where: { id: d.id },
        data: { status: 'SCHEDULED' },
      });
      return;
    }
    // One drop at a time is the design; the operator closes the last one on purpose.
    const live = await this.db.drop.findFirst({
      where: { status: 'LIVE', id: { not: d.id } },
    });
    if (live)
      throw new ConflictException(
        `Drop ${String(live.number).padStart(3, '0')} is live. Close it first.`,
      );
    const closesAt =
      d.closesAt && d.closesAt > now
        ? d.closesAt
        : new Date(now.getTime() + 72 * 3_600_000);
    await this.db.drop.update({
      where: { id: d.id },
      data: { status: 'LIVE', opensAt: now, closesAt },
    });
    this.refreshStorefront();
  }

  async close(slug: string, now = new Date()): Promise<void> {
    const d = await this.must(slug);
    if (!canDropTransition(d.status, 'ARCHIVED'))
      throw new ConflictException(
        `Only a live drop can be closed; this one is ${d.status.toLowerCase()}.`,
      );
    await this.db.drop.update({
      where: { id: d.id },
      data: { status: 'ARCHIVED', closesAt: now },
    });
    this.refreshStorefront();
  }

  async extend(slug: string, hours: number): Promise<void> {
    if (!Number.isInteger(hours) || hours < 1 || hours > 72)
      throw new BadRequestException('Extend by 1 to 72 hours.');
    const d = await this.must(slug);
    if (d.status !== 'LIVE' || !d.closesAt)
      throw new ConflictException('Only a live drop can be extended.');
    await this.db.drop.update({
      where: { id: d.id },
      data: { closesAt: new Date(d.closesAt.getTime() + hours * 3_600_000) },
    });
    this.refreshStorefront();
  }

  /** T-072: buyers, by email. Computed in memory — fine to thousands of orders; a SQL view when it is not. */
  async customers(): Promise<AdminCustomer[]> {
    const orders = await this.db.order.findMany({
      where: { status: { notIn: ['PENDING', 'CANCELLED'] } },
      select: {
        email: true,
        phone: true,
        status: true,
        totalPaise: true,
        createdAt: true,
        shippingAddress: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const by = new Map<string, AdminCustomer>();
    for (const o of orders) {
      const c = by.get(o.email) ?? {
        email: o.email,
        phone: o.phone,
        orders: 0,
        spentPaise: 0,
        delivered: 0,
        rto: 0,
        lastOrderAt: o.createdAt.toISOString(),
        cities: [],
      };
      c.orders++;
      if ((CLAIMED as readonly string[]).includes(o.status))
        c.spentPaise += o.totalPaise;
      if (o.status === 'DELIVERED') c.delivered++;
      if (o.status === 'RTO') c.rto++;
      const city = (o.shippingAddress as { city?: string } | null)?.city;
      if (city && !c.cities.includes(city)) c.cities.push(city);
      by.set(o.email, c);
    }
    return [...by.values()].sort((a, b) => b.spentPaise - a.spentPaise);
  }

  private async row(d: DropRow): Promise<AdminDropRow> {
    const claimed = await this.db.orderItem.aggregate({
      _sum: { quantity: true },
      where: {
        skuSnap: { startsWith: `NC-${String(d.number).padStart(3, '0')}-` },
        order: { status: { in: [...CLAIMED] } },
      },
    });
    return {
      number: d.number,
      slug: d.slug,
      title: d.title,
      status: d.status,
      accentColor: d.accentColor,
      opensAt: d.opensAt?.toISOString() ?? null,
      closesAt: d.closesAt?.toISOString() ?? null,
      claimed: claimed._sum.quantity ?? 0,
      editionSize: d.editionSize,
      problems: 0,
    };
  }

  private async must(slug: string): Promise<DropRow> {
    const d = await this.db.drop.findUnique({
      where: { slug },
      include: withProduct,
    });
    if (!d) throw new NotFoundException('no such drop');
    return d;
  }
}
