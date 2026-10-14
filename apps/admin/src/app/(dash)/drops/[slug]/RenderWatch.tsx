'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** While turntables render, re-read the page every 3 s; stops itself once nothing is pending. */
export function RenderWatch({ pending }: { pending: number }) {
  const router = useRouter();
  useEffect(() => {
    if (pending === 0) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [pending, router]);
  if (pending === 0) return null;
  return (
    <p role="status" className="flex items-center gap-2 text-xs text-smoke">
      <span
        className="size-[5px] animate-pulse rounded-full bg-accent"
        aria-hidden="true"
      />
      Rendering {pending} colourway{pending === 1 ? '' : 's'} — about 10 s each.
    </p>
  );
}
