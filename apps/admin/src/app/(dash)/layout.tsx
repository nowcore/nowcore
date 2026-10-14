import type { ReactNode } from 'react';
import { z } from 'zod';
import { get } from '../../lib/api';
import { signOut } from '../login/actions';
import { Nav } from '../../features/Nav';

/**
 * The admin shell: dense, fast, zero motion (docs/10 — the admin is a tool,
 * not a statement). Resolving the operator here means every page under it is
 * behind a live session; the API re-checks on every request regardless.
 */
export default async function DashLayout({
  children,
}: {
  children: ReactNode;
}) {
  const me = await get(
    '/admin/me',
    z.object({ email: z.string(), name: z.string() }),
  );
  const attention = await get(
    '/admin/orders?status=attention',
    z.object({ counts: z.record(z.string(), z.number()) }),
  );
  return (
    <div className="flex min-h-dvh flex-wrap bg-void font-sans text-[13px] text-paper">
      <aside className="flex min-w-[180px] flex-[0_1_216px] flex-col gap-6 border-r border-steel px-3.5 py-5">
        <div className="px-2">
          <p className="text-[15px] font-semibold tracking-tight">NOWCORE</p>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-smoke">
            Admin
          </p>
        </div>
        <Nav attention={attention.counts['attention'] ?? 0} />
        <div className="mt-auto flex flex-col gap-2 rounded border border-steel p-3">
          <p className="truncate text-xs text-paper-dim">{me.email}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="min-h-8 text-xs text-smoke underline underline-offset-4"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-[999_1_640px]">{children}</div>
    </div>
  );
}
