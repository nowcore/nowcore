import { z } from 'zod';
import { OrderStatus, PaymentMethod } from './order.js';
import { Paise } from './money.js';

/** Admin contracts (Phase 4). Parsed by apps/admin exactly as the storefront parses its own. */
export const Login = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});

export const Session = z.object({
  token: z.string(),
  expiresAt: z.string(),
  operator: z.object({ email: z.string(), name: z.string() }),
});
export type Session = z.infer<typeof Session>;

export const AdminOrderRow = z.object({
  reference: z.string(),
  status: OrderStatus,
  method: PaymentMethod.nullable(),
  email: z.string(),
  phone: z.string(),
  city: z.string().nullable(),
  summary: z.string(),
  totalPaise: Paise,
  createdAt: z.string(),
});
export type AdminOrderRow = z.infer<typeof AdminOrderRow>;

export const AdminOrderList = z.object({
  orders: z.array(AdminOrderRow),
  counts: z.record(z.string(), z.number().int()),
});
export type AdminOrderList = z.infer<typeof AdminOrderList>;

export const AdminOrderDetail = AdminOrderRow.extend({
  address: z.record(z.string(), z.unknown()),
  podOrderId: z.string().nullable(),
  providerOrderId: z.string().nullable(),
  trackingUrl: z.string().nullable(),
  subtotalPaise: Paise,
  shippingPaise: Paise,
  lines: z.array(
    z.object({
      title: z.string(),
      sku: z.string(),
      size: z.string(),
      colour: z.string(),
      pricePaise: Paise,
      quantity: z.number().int(),
    }),
  ),
  events: z.array(
    z.object({
      from: OrderStatus.nullable(),
      to: OrderStatus,
      source: z.string(),
      at: z.string(),
      payload: z.unknown(),
    }),
  ),
  /** What the operator can do now, decided by the state machine, not the page. */
  actions: z.array(z.enum(['retry', 'cancel', 'refund'])),
});
export type AdminOrderDetail = z.infer<typeof AdminOrderDetail>;

export const Dashboard = z.object({
  range: z.enum(['today', '7d', '30d']),
  revenuePaise: Paise,
  orders: z.number().int(),
  aovPaise: Paise,
  codShare: z.number(),
  /** Of orders paid in range and old enough to judge, the share at the printer within 24 h. */
  printSla: z.number().nullable(),
  needsAttention: z.number().int(),
});
export type Dashboard = z.infer<typeof Dashboard>;
