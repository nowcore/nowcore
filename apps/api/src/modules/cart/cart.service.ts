import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isOpen, type CartView, type SetItem } from '@nowcore/shared';
import { ENV, type Env } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';
import { assetUrl } from '../assets/asset-url.js';

/**
 * Carts (T-048). Possession of the id is access — it is an unguessable UUID
 * held in an httpOnly cookie by the web app. Every change is checked against
 * the variant's real stock and its drop's status; the price shown is always
 * the variant's current price, and the order re-checks both again (T-051).
 */
@Injectable()
export class CartService {
  constructor(
    private readonly db: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(): Promise<CartView> {
    const cart = await this.db.cart.create({ data: {} });
    return this.view(cart.id);
  }

  async view(id: string): Promise<CartView> {
    const cart = await this.db.cart.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!cart) throw new NotFoundException('no such cart');
    const variants = await this.db.variant.findMany({
      where: { id: { in: cart.items.map((i) => i.variantId) } },
      include: { product: { include: { drop: true } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    const lines = cart.items
      .map((item) => {
        const v = byId.get(item.variantId);
        if (!v) return null;
        return {
          sku: v.sku,
          productSlug: v.product.slug,
          title: v.product.title,
          colourName: v.colorName,
          size: v.size,
          pricePaise: v.pricePaise,
          quantity: item.quantity,
          available: !v.soldOut && isOpen(v.product.drop),
          still: assetUrl(this.env.ASSET_BASE_URL, v.mockupUrl),
        };
      })
      .filter((l) => l !== null)
      .sort((a, b) => a.sku.localeCompare(b.sku));
    const live = lines.filter((l) => l.available);
    return {
      id: cart.id,
      lines,
      count: live.reduce((n, l) => n + l.quantity, 0),
      subtotalPaise: live.reduce((t, l) => t + l.pricePaise * l.quantity, 0),
    };
  }

  async setItem(id: string, input: SetItem): Promise<CartView> {
    const cart = await this.db.cart.findUnique({ where: { id } });
    if (!cart) throw new NotFoundException('no such cart');
    const variant = await this.db.variant.findUnique({
      where: { sku: input.sku },
      include: { product: { include: { drop: true } } },
    });
    if (!variant) throw new BadRequestException('no such item');

    if (input.quantity === 0) {
      await this.db.cartItem.deleteMany({
        where: { cartId: id, variantId: variant.id },
      });
      return this.view(id);
    }
    if (!isOpen(variant.product.drop))
      throw new ConflictException('this drop is not open');
    if (variant.soldOut) throw new ConflictException('that size has sold out');

    await this.db.cartItem.upsert({
      where: { cartId_variantId: { cartId: id, variantId: variant.id } },
      create: { cartId: id, variantId: variant.id, quantity: input.quantity },
      update: { quantity: input.quantity },
    });
    await this.db.cart.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    return this.view(id);
  }
}
