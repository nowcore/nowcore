import { z } from 'zod';

export const OrderStatus = z.enum([
  'PENDING',
  'PAID',
  'FULFILMENT_QUEUED',
  'FULFILMENT_FAILED',
  'PRINTING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
  'RTO',
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PaymentMethod = z.enum([
  'UPI',
  'CARD',
  'NETBANKING',
  'WALLET',
  'COD',
]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

/**
 * The order state machine, docs/05-lld.md §4.
 *
 * Every transition the system may make, and nothing else. A webhook that asks
 * for a transition not in this table is out of order or duplicated, and is
 * recorded but not applied.
 */
const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['FULFILMENT_QUEUED', 'REFUNDED'],
  FULFILMENT_QUEUED: ['PRINTING', 'FULFILMENT_FAILED'],
  FULFILMENT_FAILED: ['FULFILMENT_QUEUED', 'REFUNDED'],
  PRINTING: ['SHIPPED'],
  SHIPPED: ['DELIVERED', 'RTO'],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
  RTO: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
