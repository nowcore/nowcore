/**
 * The data model, and the one place the rest of the repo imports it.
 *
 * No service and no connection: Prisma 7 takes a driver adapter from whoever
 * constructs the client, and only the running process — the API with its
 * pool, the worker, a script — knows which it should be.
 */
export { PrismaClient, Prisma } from '@prisma/client';
export type {
  Asset,
  Cart,
  CartItem,
  Customer,
  Address,
  Drop,
  DropStatus,
  Operator,
  OperatorSession,
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  Trend,
  TrendStatus,
  Variant,
  WaitlistSubscription,
  DropAlert,
  WallPost,
  WebhookEvent,
} from '@prisma/client';
