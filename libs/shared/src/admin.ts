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

export const BLANK_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const;

const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase words joined by hyphens')
  .max(60);
const When = z.iso.datetime({ offset: true }).nullable();

export const CreateDrop = z.object({
  number: z.number().int().min(1).max(999),
  slug: Slug,
  title: z.string().trim().min(2).max(60),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'a six-digit hex, #RRGGBB'),
  editionSize: z.number().int().min(1).max(100_000).nullable(),
  colourways: z
    .array(z.enum(['blk', 'bone', 'ash', 'moss']))
    .min(1, 'choose at least one colourway'),
  pricePaise: z.number().int().min(10_000).max(1_000_000),
  description: z.string().trim().min(10).max(600),
});
export type CreateDrop = z.infer<typeof CreateDrop>;

export const UpdateDrop = z.object({
  title: z.string().trim().min(2).max(60).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  editionSize: z.number().int().min(1).max(100_000).nullable().optional(),
  opensAt: When.optional(),
  closesAt: When.optional(),
  description: z.string().trim().min(10).max(600).optional(),
});
export type UpdateDrop = z.infer<typeof UpdateDrop>;

export const UpdateVariant = z.object({
  /** Empty string clears the mapping. */
  podVariantId: z.string().trim().max(80).optional(),
  pricePaise: z.number().int().min(10_000).max(1_000_000).optional(),
  soldOut: z.boolean().optional(),
});

export const AdminVariant = z.object({
  sku: z.string(),
  size: z.string(),
  colourName: z.string(),
  pricePaise: Paise,
  soldOut: z.boolean(),
  podVariantId: z.string().nullable(),
  still: z.string().nullable(),
  rendered: z.boolean(),
});

export const AdminDropRow = z.object({
  number: z.number().int(),
  slug: z.string(),
  title: z.string(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'ARCHIVED']),
  accentColor: z.string(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  claimed: z.number().int(),
  editionSize: z.number().int().nullable(),
  problems: z.number().int(),
});
export type AdminDropRow = z.infer<typeof AdminDropRow>;

export const AdminDropDetail = AdminDropRow.extend({
  chapters: z.array(
    z.object({
      key: z.string(),
      kicker: z.string(),
      lineOne: z.string(),
      lineTwo: z.string(),
      body: z.string().optional(),
    }),
  ),
  product: z
    .object({
      slug: z.string(),
      title: z.string(),
      description: z.string(),
      hasArtwork: z.boolean(),
    })
    .nullable(),
  variants: z.array(AdminVariant),
  /** Everything stopping this drop from opening. Empty = publishable. */
  problemList: z.array(z.string()),
});
export type AdminDropDetail = z.infer<typeof AdminDropDetail>;

export const AdminCustomer = z.object({
  email: z.string(),
  phone: z.string(),
  orders: z.number().int(),
  spentPaise: Paise,
  delivered: z.number().int(),
  rto: z.number().int(),
  lastOrderAt: z.string(),
  cities: z.array(z.string()),
});
export type AdminCustomer = z.infer<typeof AdminCustomer>;
