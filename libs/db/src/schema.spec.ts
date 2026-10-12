import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OrderStatus as SharedOrderStatus } from '@nowcore/shared';

/**
 * The rules the schema encodes, read back out of it.
 *
 * Not a test of Prisma. A test of the decisions in docs/05-lld.md that are
 * invisible once written and expensive once wrong.
 */
const schema = readFileSync(
  join(import.meta.dirname, '../prisma/schema.prisma'),
  'utf8',
);
const code = schema.replace(/\/\/.*$/gm, '');

function block(kind: 'model' | 'enum', name: string): string {
  const at = code.indexOf(`${kind} ${name} {`);
  if (at === -1) throw new Error(`no ${kind} ${name}`);
  return code.slice(at, code.indexOf('\n}', at));
}

describe('the schema', () => {
  it('never stores money as a float or decimal', () => {
    expect(code).not.toMatch(/\b(Float|Decimal)\b/);
    for (const [m, field] of [
      ['Variant', 'pricePaise'],
      ['OrderItem', 'pricePaise'],
      ['Order', 'totalPaise'],
      ['Product', 'basePaise'],
    ] as const) {
      expect(block('model', m)).toMatch(new RegExp(`${field}\\s+Int\\b`));
    }
  });

  it('snapshots what was bought onto each order item', () => {
    const item = block('model', 'OrderItem');
    for (const snap of [
      'titleSnap',
      'skuSnap',
      'sizeSnap',
      'colorSnap',
      'pricePaise',
    ]) {
      expect(item).toMatch(new RegExp(`\\b${snap}\\s+(String|Int)\\b`));
    }
    // A relation to Variant would invite a join for display — the exact thing
    // the snapshots exist to prevent.
    expect(item).not.toMatch(/\bVariant\b/);
  });

  it('makes webhook idempotency a unique constraint', () => {
    expect(block('model', 'WebhookEvent')).toMatch(
      /@@unique\(\[provider, eventId\]\)/,
    );
  });

  it('lets a variant exist unmapped, so the publish check can refuse it', () => {
    expect(block('model', 'Variant')).toMatch(/podVariantId\s+String\?/);
  });

  it('agrees with @nowcore/shared on every order status', () => {
    const statuses = block('enum', 'OrderStatus')
      .match(/^\s+([A-Z_]+)$/gm)
      ?.map((s) => s.trim());
    expect(statuses).toEqual(SharedOrderStatus.options);
  });

  it('has a migration that creates every table', () => {
    const dir = join(import.meta.dirname, '../prisma/migrations');
    const sql = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => readFileSync(join(dir, d.name, 'migration.sql'), 'utf8'))
      .join('\n');
    for (const table of code.matchAll(/@@map\("(\w+)"\)/g)) {
      expect(sql).toContain(`CREATE TABLE "${table[1]}"`);
    }
  });
});
