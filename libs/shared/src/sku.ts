import { z } from 'zod';

/**
 * `NC-014-TEE-BLK-L`: brand, drop, garment, colour code, size.
 * The SKU is what an operator reads off an order board and what the variant
 * map in libs/pod is keyed on, so it has exactly one format.
 */
export const Garment = z.enum(['TEE', 'CAP', 'HOOD', 'TOTE']);
export const Size = z.enum(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'OS']);
export type Size = z.infer<typeof Size>;

const SKU =
  /^NC-(\d{3})-(TEE|CAP|HOOD|TOTE)-([A-Z]{2,5})-(XS|S|M|L|XL|2XL|3XL|OS)$/;

export interface SkuParts {
  drop: number;
  garment: z.infer<typeof Garment>;
  color: string;
  size: Size;
}

export function makeSku(parts: SkuParts): string {
  const sku = `NC-${String(parts.drop).padStart(3, '0')}-${parts.garment}-${parts.color.toUpperCase()}-${parts.size}`;
  if (!SKU.test(sku)) throw new Error(`not a valid SKU: ${sku}`);
  return sku;
}

export function parseSku(sku: string): SkuParts {
  const m = SKU.exec(sku);
  if (!m) throw new Error(`not a valid SKU: ${sku}`);
  const [, drop, garment, color, size] = m as unknown as [
    string,
    string,
    string,
    string,
    string,
  ];
  return {
    drop: Number(drop),
    garment: Garment.parse(garment),
    color,
    size: Size.parse(size),
  };
}
