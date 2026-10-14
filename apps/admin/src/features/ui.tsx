import type { OrderStatus } from '@nowcore/shared';

/** Status pills: hue and lightness both differ, so they read without colour vision. */
const TONE: Record<OrderStatus, string> = {
  PENDING: 'text-smoke bg-paper/5',
  PAID: 'text-info bg-info/10',
  FULFILMENT_QUEUED: 'text-info bg-info/10',
  FULFILMENT_FAILED: 'text-bad bg-bad/10',
  PRINTING: 'text-accent bg-accent/10',
  SHIPPED: 'text-paper-dim bg-paper/5',
  DELIVERED: 'text-ok bg-ok/10',
  CANCELLED: 'text-ghost bg-paper/5',
  REFUNDED: 'text-warn bg-warn/10',
  RTO: 'text-warn bg-warn/10',
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex min-h-[22px] items-center rounded-[3px] px-2 font-mono text-[9px] uppercase tracking-[0.14em] ${TONE[status]}`}
    >
      {status.replace('_', ' ').toLowerCase()}
    </span>
  );
}

export const micro =
  'font-mono text-[9px] uppercase tracking-[0.18em] text-ghost';
