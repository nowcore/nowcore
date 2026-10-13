'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { CanvasSequence } from '@nowcore/motion';
import type { ProductView } from '@nowcore/shared';
import { formatInr } from '@nowcore/shared/format';
import { addToCart } from '../cart/actions';

/**
 * The product page's interactive half (T-047). It owns the two-column grid
 * because the turntable (left) and the controls (right) share the chosen
 * colourway. Left holds only the sticky turntable, so nothing can sit under
 * it — the first version stacked the controls in the same column and the
 * canvas was painted over the buttons. Sold-out sizes are struck through and
 * disabled, never hidden (FR-5).
 */
export function ProductStage({
  product,
  open,
  header,
  details,
}: {
  product: ProductView;
  open: boolean;
  /** Server-rendered title block, above the controls. */
  header: ReactNode;
  /** Server-rendered specs below the controls — the column the turn scrolls against. */
  details: ReactNode;
}) {
  const [colourCode, setColourCode] = useState(
    product.colourways[0]?.code ?? '',
  );
  const colour =
    product.colourways.find((c) => c.code === colourCode) ??
    product.colourways[0];
  const [size, setSize] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [pending, start] = useTransition();

  const chosen = colour?.sizes.find((s) => s.size === size && !s.soldOut);
  const price = chosen?.pricePaise ?? product.fromPaise;

  const pickColour = (code: string) => {
    setColourCode(code);
    // Keep the size only if it exists, unsold, in the new colourway.
    const next = product.colourways.find((c) => c.code === code);
    if (size && next?.sizes.find((s) => s.size === size)?.soldOut !== false)
      setSize(null);
    setMessage('');
  };

  const buy = () => {
    if (!chosen) {
      setMessage('Choose a size first.');
      return;
    }
    start(async () => {
      const r = await addToCart(chosen.sku);
      setMessage(r.ok ? `Added — ${r.count} in your cart.` : r.error);
    });
  };

  return (
    <div className="grid grid-cols-1 gap-x-14 md:grid-cols-2">
      <div className="md:sticky md:top-0 md:flex md:h-svh md:items-center">
        <div className="relative mx-auto w-[min(320px,60vw)] md:w-full md:max-w-[440px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[460px] max-w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(ellipse at center, var(--drop-glow) 0%, transparent 70%)',
            }}
          />
          {colour?.frames && (
            <CanvasSequence
              key={colour.code}
              frames={colour.frames.full}
              reducedFrames={colour.frames.reduced}
              fallback={colour.frames.still}
              alt={`${product.title} tee in ${colour.name}`}
              width={colour.frames.width}
              height={colour.frames.height}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-8 py-6 md:pb-[40svh] md:pt-32">
        {header}

        <fieldset className="flex flex-col gap-3.5">
          <legend className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.18em] text-smoke">
            Colour — {colour?.name}
          </legend>
          <div className="flex flex-wrap gap-3">
            {product.colourways.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pickColour(c.code)}
                aria-label={c.name}
                aria-pressed={c.code === colour?.code}
                className={`inline-flex size-11 items-center justify-center rounded-full border ${c.code === colour?.code ? 'border-accent' : 'border-steel'}`}
              >
                <span
                  className="size-[22px] rounded-full border border-paper/20"
                  style={{ background: c.hex }}
                />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3.5">
          <legend className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.18em] text-smoke">
            Size — {size ?? 'choose one'}
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {colour?.sizes.map((s) => (
              <button
                key={s.size}
                type="button"
                disabled={s.soldOut || !open}
                onClick={() => {
                  setSize(s.size);
                  setMessage('');
                }}
                aria-pressed={s.size === size}
                aria-label={s.soldOut ? `${s.size}, sold out` : s.size}
                className={`min-h-12 min-w-[54px] rounded-[3px] border px-3.5 font-mono text-xs tracking-[0.1em] ${
                  s.size === size && !s.soldOut
                    ? 'border-accent bg-accent text-void'
                    : s.soldOut
                      ? 'cursor-not-allowed border-steel text-ghost line-through'
                      : 'border-steel text-paper'
                }`}
              >
                {s.size}
              </button>
            ))}
          </div>
        </fieldset>

        {details}
      </div>

      {/* The persistent buy bar: the cinema never costs the sale (docs/10). */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-steel bg-ash/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-10">
          <div className="flex flex-col">
            <span className="text-[15px] text-paper">{product.title}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ghost">
              {colour?.name} · {size ?? '—'}
            </span>
          </div>
          <p
            role="status"
            aria-live="polite"
            className="order-last w-full text-sm text-smoke md:order-none md:w-auto"
          >
            {message}
          </p>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xl text-paper">
              {formatInr(price)}
            </span>
            <button
              type="button"
              onClick={buy}
              disabled={!open || pending}
              className="min-h-[52px] rounded-full bg-accent px-8 text-[15px] font-medium text-void disabled:opacity-50"
            >
              {!open ? 'Drop closed' : pending ? 'Adding…' : 'Add to cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
