import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@nowcore/db';
import {
  Chapters,
  framesAt,
  parseSku,
  type DropSummary,
  type DropView,
  type ProductPage,
  type ProductView,
} from '@nowcore/shared';
import { PrismaService } from '../../prisma.service.js';

/** Order statuses that count as a claimed garment: money was taken. */
const CLAIMED = [
  'PAID',
  'FULFILMENT_QUEUED',
  'FULFILMENT_FAILED',
  'PRINTING',
  'SHIPPED',
  'DELIVERED',
] as const;
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'OS'];

const productInclude = { variants: true } satisfies Prisma.ProductInclude;
type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type DropRow = Prisma.DropGetPayload<object>;

/**
 * Read side of the catalogue (T-045). Public, unauthenticated, cacheable.
 * Shapes are the zod contracts in @nowcore/shared/catalogue.
 */
@Injectable()
export class CatalogueService {
  constructor(private readonly db: PrismaService) {}

  async liveDrop(): Promise<DropView> {
    // The live drop; if none is live, the most recent one, so the film always
    // has something to show (docs/02 F1, edge cases).
    const drop =
      (await this.db.drop.findFirst({
        where: { status: 'LIVE' },
        orderBy: { opensAt: 'desc' },
      })) ??
      (await this.db.drop.findFirst({
        where: { status: { in: ['ARCHIVED', 'SCHEDULED'] } },
        orderBy: { number: 'desc' },
      }));
    if (!drop) throw new NotFoundException('no drops yet');
    return this.dropView(drop);
  }

  async drop(slug: string): Promise<DropView> {
    const drop = await this.db.drop.findUnique({ where: { slug } });
    if (!drop || drop.status === 'DRAFT')
      throw new NotFoundException('no such drop');
    return this.dropView(drop);
  }

  async archive(): Promise<DropSummary[]> {
    const drops = await this.db.drop.findMany({
      where: { status: 'ARCHIVED' },
      orderBy: { number: 'desc' },
    });
    return Promise.all(drops.map((d) => this.summary(d)));
  }

  async product(slug: string): Promise<ProductPage> {
    const product = await this.db.product.findUnique({
      where: { slug },
      include: { ...productInclude, drop: true },
    });
    if (!product || product.drop.status === 'DRAFT')
      throw new NotFoundException('no such product');
    return {
      drop: await this.summary(product.drop),
      product: this.productView(product),
    };
  }

  private async dropView(drop: DropRow): Promise<DropView> {
    const products = await this.db.product.findMany({
      where: { dropId: drop.id },
      include: productInclude,
    });
    return {
      ...(await this.summary(drop)),
      chapters: Chapters.parse(drop.chapters),
      products: products.map((p) => this.productView(p)),
    };
  }

  private async summary(drop: DropRow): Promise<DropSummary> {
    const [claimed, first] = await Promise.all([
      this.db.orderItem.aggregate({
        _sum: { quantity: true },
        where: {
          order: { status: { in: [...CLAIMED] } },
          skuSnap: {
            startsWith: `NC-${String(drop.number).padStart(3, '0')}-`,
          },
        },
      }),
      // The hero colourway's still (black), as the product view orders
      // colourways; any variant if a drop has no black.
      this.db.variant
        .findFirst({
          where: { product: { dropId: drop.id }, sku: { contains: '-BLK-' } },
        })
        .then(
          (v) =>
            v ??
            this.db.variant.findFirst({
              where: { product: { dropId: drop.id } },
              orderBy: { sku: 'asc' },
            }),
        ),
    ]);
    return {
      number: drop.number,
      slug: drop.slug,
      title: drop.title,
      accentColor: drop.accentColor,
      status: drop.status,
      opensAt: drop.opensAt?.toISOString() ?? null,
      closesAt: drop.closesAt?.toISOString() ?? null,
      editionSize: drop.editionSize,
      claimed: claimed._sum.quantity ?? 0,
      still: first?.mockupUrl ?? null,
    };
  }

  private productView(p: ProductRow): ProductView {
    // Colourways in seed order (first variant seen), sizes in garment order.
    const byColour = new Map<string, ProductRow['variants']>();
    for (const v of [...p.variants].sort((a, b) =>
      a.sku.localeCompare(b.sku),
    )) {
      const list = byColour.get(v.colorName) ?? [];
      list.push(v);
      byColour.set(v.colorName, list);
    }
    const colourways = [...byColour.entries()].map(([name, vs]) => {
      const first = vs[0] as (typeof vs)[number];
      return {
        code: parseSku(first.sku).color.toLowerCase(),
        name,
        hex: first.colorHex,
        frames: first.sequenceUrl ? framesAt(first.sequenceUrl) : null,
        sizes: vs
          .sort(
            (a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size),
          )
          .map((v) => ({
            size: v.size,
            sku: v.sku,
            pricePaise: v.pricePaise,
            soldOut: v.soldOut,
          })),
      };
    });
    // Black first: it is the hero colourway everywhere in the design.
    colourways.sort((a, b) =>
      a.code === 'blk' ? -1 : b.code === 'blk' ? 1 : 0,
    );
    return {
      slug: p.slug,
      title: p.title,
      description: p.description,
      fromPaise: Math.min(...p.variants.map((v) => v.pricePaise)),
      colourways,
    };
  }
}
