import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isOpen,
  priceOrder,
  type OrderView,
  type PlaceOrder,
  type PlacedOrder,
  type VerifyPayment,
} from '@nowcore/shared';
import { ENV, type Env } from '../../env.js';
import { PrismaService } from '../../prisma.service.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../payments/payment-provider.js';
import { OrderStateService } from './order-state.service.js';
import { orderToken, validOrderToken } from '@nowcore/orders';

const CLAIMED = [
  'PAID',
  'FULFILMENT_QUEUED',
  'FULFILMENT_FAILED',
  'PRINTING',
  'SHIPPED',
  'DELIVERED',
] as const;

/**
 * Placing and paying for orders (T-050–T-053).
 *
 * The cart is a suggestion. At the moment of ordering, every line is
 * re-checked against the variant as it is now — stock, the drop still being
 * open, the edition not exhausted — and priced from the variant, not from
 * anything the browser sent. What was bought is then copied onto the order
 * items, so a later catalogue change can never rewrite it (CLAUDE.md, rule 4).
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: PrismaService,
    private readonly state: OrderStateService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async place(input: PlaceOrder): Promise<PlacedOrder> {
    const cart = await this.db.cart.findUnique({
      where: { id: input.cartId },
      include: { items: true },
    });
    if (!cart || cart.items.length === 0)
      throw new ConflictException('Your cart is empty.');

    const variants = await this.db.variant.findMany({
      where: { id: { in: cart.items.map((i) => i.variantId) } },
      include: { product: { include: { drop: true } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    const lines = cart.items.map((item) => {
      const v = byId.get(item.variantId);
      if (!v)
        throw new ConflictException('Something in your cart no longer exists.');
      if (!isOpen(v.product.drop))
        throw new ConflictException(
          `${v.product.title} — this drop has closed.`,
        );
      if (v.soldOut)
        throw new ConflictException(
          `${v.product.title} in ${v.size} has sold out.`,
        );
      return { item, v };
    });

    // The edition limit, per drop.
    for (const drop of new Map(
      lines.map(({ v }) => [v.product.drop.id, v.product.drop]),
    ).values()) {
      if (drop.editionSize === null) continue;
      const prefix = `NC-${String(drop.number).padStart(3, '0')}-`;
      const claimed =
        (
          await this.db.orderItem.aggregate({
            _sum: { quantity: true },
            where: {
              skuSnap: { startsWith: prefix },
              order: { status: { in: [...CLAIMED] } },
            },
          })
        )._sum.quantity ?? 0;
      const wanted = lines
        .filter(({ v }) => v.product.drop.id === drop.id)
        .reduce((n, l) => n + l.item.quantity, 0);
      if (claimed + wanted > drop.editionSize) {
        throw new ConflictException(
          `Only ${Math.max(0, drop.editionSize - claimed)} left in this edition.`,
        );
      }
    }

    if (input.pay === 'COD') await this.assertCodAllowed(input.phone);

    const subtotal = lines.reduce(
      (t, { item, v }) => t + v.pricePaise * item.quantity,
      0,
    );
    const totals = priceOrder(subtotal, input.pay);
    const [{ n }] = await this.db.$queryRaw<
      [{ n: bigint }]
    >`SELECT nextval('order_reference_seq') AS n`;
    const reference = `NC-${n}`;

    const order = await this.db.order.create({
      data: {
        reference,
        email: input.email,
        phone: input.phone,
        status: 'PENDING',
        method: input.pay === 'COD' ? 'COD' : null,
        ...totals,
        shippingAddress: input.address,
        cartId: cart.id,
        items: {
          create: lines.map(({ item, v }) => ({
            variantId: v.id,
            titleSnap: v.product.title,
            skuSnap: v.sku,
            sizeSnap: v.size,
            colorSnap: v.colorName,
            pricePaise: v.pricePaise,
            quantity: item.quantity,
          })),
        },
        events: {
          create: {
            to: 'PENDING',
            source: 'system',
            payload: { pay: input.pay },
          },
        },
      },
    });
    const token = orderToken(this.env.ORDER_TOKEN_SECRET, reference);

    if (input.pay === 'COD') {
      // COD has no payment to wait for; it is confirmed for fulfilment now.
      // The confirmation call/OTP before printing (docs/11) is not built yet.
      await this.state.markPaid(order, 'system', { cod: true }, 'COD');
      return { reference, token, status: 'PAID', payment: null };
    }

    let handoff;
    try {
      handoff = await this.payments.createOrder({
        amountPaise: totals.totalPaise,
        receipt: reference,
      });
    } catch (cause) {
      // The order exists as PENDING with no provider order: it can never be
      // paid, and reconciliation skips it. The buyer's cart is untouched.
      throw new BadGatewayException(
        'Payments are unavailable right now. Your cart is saved — try again shortly.',
        { cause },
      );
    }
    await this.db.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: handoff.providerOrderId },
    });
    return {
      reference,
      token,
      status: 'PENDING',
      payment: {
        provider: this.payments.name,
        providerOrderId: handoff.providerOrderId,
        keyId: handoff.keyId,
        amountPaise: totals.totalPaise,
      },
    };
  }

  /** The browser's "payment succeeded" report. Trusted only if the signature checks. */
  async verify(
    reference: string,
    input: VerifyPayment,
  ): Promise<{ status: string }> {
    const order = await this.db.order.findUnique({ where: { reference } });
    if (!order || order.razorpayOrderId !== input.providerOrderId)
      throw new NotFoundException('no such order');
    if (!this.payments.verifyCheckout(input))
      throw new BadRequestException('payment signature does not match');
    await this.state.markPaid(
      order,
      `${this.payments.name}:checkout`,
      { paymentId: input.paymentId },
      null,
    );
    const now = await this.db.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    return { status: now.status };
  }

  async view(reference: string, token: string | undefined): Promise<OrderView> {
    if (!validOrderToken(this.env.ORDER_TOKEN_SECRET, reference, token))
      throw new ForbiddenException('bad link');
    const o = await this.db.order.findUnique({
      where: { reference },
      include: { items: true },
    });
    if (!o) throw new NotFoundException('no such order');
    return {
      reference: o.reference,
      status: o.status,
      method: o.method,
      email: o.email,
      lines: o.items.map((i) => ({
        title: i.titleSnap,
        sku: i.skuSnap,
        size: i.sizeSnap,
        colour: i.colorSnap,
        pricePaise: i.pricePaise,
        quantity: i.quantity,
      })),
      subtotalPaise: o.subtotalPaise,
      shippingPaise: o.shippingPaise,
      taxPaise: o.taxPaise,
      totalPaise: o.totalPaise,
      trackingUrl: o.trackingUrl,
      createdAt: o.createdAt.toISOString(),
    };
  }

  /**
   * docs/11: COD returns run 15–30% and a printed garment cannot be unprinted.
   * COD opens only after one prepaid order has been delivered to this phone.
   */
  private async assertCodAllowed(phone: string): Promise<void> {
    const delivered = await this.db.order.count({
      where: { phone, status: 'DELIVERED', NOT: { method: 'COD' } },
    });
    if (delivered === 0) {
      throw new ConflictException(
        'Cash on delivery opens after your first prepaid order arrives.',
      );
    }
  }
}
