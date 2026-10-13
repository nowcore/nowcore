import { z } from 'zod';
import { Paise } from './money.js';

/** Most of one SKU a single cart may hold. A drop is scarce by design. */
export const MAX_PER_LINE = 5;

export const SetItem = z.object({
  sku: z.string().min(1).max(40),
  /** 0 removes the line. */
  quantity: z.number().int().min(0).max(MAX_PER_LINE),
});
export type SetItem = z.infer<typeof SetItem>;

export const CartLine = z.object({
  sku: z.string(),
  productSlug: z.string(),
  title: z.string(),
  colourName: z.string(),
  size: z.string(),
  pricePaise: Paise,
  quantity: z.number().int(),
  /** False when the size sold out or the drop closed since it was added. */
  available: z.boolean(),
  still: z.string().nullable(),
});
export type CartLine = z.infer<typeof CartLine>;

export const CartView = z.object({
  id: z.uuid(),
  lines: z.array(CartLine),
  count: z.number().int(),
  subtotalPaise: Paise,
});
export type CartView = z.infer<typeof CartView>;
