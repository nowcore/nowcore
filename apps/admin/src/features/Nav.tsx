'use client';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/drops', label: 'Drops' },
  { href: '/radar', label: 'Radar' },
  { href: '/customers', label: 'Customers' },
] as const;

export function Nav({ attention }: { attention: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-px">
      {ITEMS.map((i) => {
        const on = i.href === '/' ? path === '/' : path.startsWith(i.href);
        return (
          <a
            key={i.href}
            href={i.href}
            aria-current={on ? 'page' : undefined}
            className={`flex min-h-9 items-center justify-between rounded px-2.5 ${on ? 'bg-ash text-paper' : 'text-smoke hover:text-paper'}`}
          >
            {i.label}
            {i.href === '/orders' && attention > 0 && (
              <span
                className="font-mono text-[10px] text-bad"
                aria-label={`${attention} need attention`}
              >
                {attention}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
