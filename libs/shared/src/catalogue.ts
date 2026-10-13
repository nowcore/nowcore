import { z } from 'zod';
import { Chapter, DropStatus } from './drop.js';
import { Paise } from './money.js';

/**
 * The catalogue as the API returns it and the web app reads it (T-045).
 * One schema, both sides: the web parses every response with these, so a
 * shape change in the API fails loudly at the boundary instead of rendering
 * `undefined` on a product page.
 */
export const SizeStock = z.object({
  size: z.string(),
  sku: z.string(),
  pricePaise: Paise,
  soldOut: z.boolean(),
});

export const Frames = z.object({
  still: z.string(),
  full: z.array(z.string()),
  reduced: z.array(z.string()),
  width: z.number().int(),
  height: z.number().int(),
});
export type Frames = z.infer<typeof Frames>;

export const Colourway = z.object({
  code: z.string(),
  name: z.string(),
  hex: z.string(),
  sizes: z.array(SizeStock),
  frames: Frames.nullable(),
});
export type Colourway = z.infer<typeof Colourway>;

export const ProductView = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  fromPaise: Paise,
  colourways: z.array(Colourway),
});
export type ProductView = z.infer<typeof ProductView>;

export const DropSummary = z.object({
  number: z.number().int(),
  slug: z.string(),
  title: z.string(),
  accentColor: z.string(),
  status: DropStatus,
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  editionSize: z.number().int().nullable(),
  claimed: z.number().int(),
  still: z.string().nullable(),
});
export type DropSummary = z.infer<typeof DropSummary>;

export const DropView = DropSummary.extend({
  chapters: z.array(Chapter),
  products: z.array(ProductView),
});
export type DropView = z.infer<typeof DropView>;

export const ProductPage = z.object({
  drop: DropSummary,
  product: ProductView,
});
export type ProductPage = z.infer<typeof ProductPage>;

/** Frame URL lists from a colourway's storage prefix (apps/worker/src/render). */
export function framesAt(prefix: string): Frames {
  const pad = (i: number) => String(i).padStart(2, '0');
  return {
    still: `${prefix}/still.avif`,
    full: Array.from({ length: 72 }, (_, i) => `${prefix}/d/f${pad(i)}.avif`),
    reduced: Array.from(
      { length: 24 },
      (_, i) => `${prefix}/m/f${pad(i)}.avif`,
    ),
    width: 800,
    height: 992,
  };
}
