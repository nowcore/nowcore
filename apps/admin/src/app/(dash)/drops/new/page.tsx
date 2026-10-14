import { z } from 'zod';
import { AdminDropRow } from '@nowcore/shared';
import { get } from '../../../../lib/api';
import { NewDropForm } from './NewDropForm';

export const dynamic = 'force-dynamic';

export default async function NewDrop() {
  const drops = await get('/admin/drops', z.array(AdminDropRow));
  const next =
    Math.max(0, ...drops.filter((d) => d.number < 800).map((d) => d.number)) +
    1;
  return (
    <main className="flex flex-col">
      <header className="flex items-center gap-3 border-b border-steel px-5 py-3.5">
        <a href="/drops" className="text-xs text-smoke hover:underline">
          Drops
        </a>
        <span className="text-ghost">/</span>
        <h1 className="text-sm font-medium">New drop</h1>
      </header>
      <div className="p-5">
        <NewDropForm nextNumber={next} />
      </div>
    </main>
  );
}
