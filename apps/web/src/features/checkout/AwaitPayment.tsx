'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * T-053: the payment succeeded in the provider's sheet but the order has not
 * caught up — the verify call was slow, or this tab is ahead of the webhook.
 * Refresh for 30 s rather than show an error; after that, say what happens.
 */
export function AwaitPayment() {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 2000);
    const stop = setTimeout(() => {
      clearInterval(id);
      setGaveUp(true);
    }, 30_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [router]);
  return (
    <p role="status" aria-live="polite" className="text-smoke">
      {gaveUp
        ? 'Still confirming with the bank. If you paid, this order is safe — you will get an email the moment it lands.'
        : 'Confirming your payment…'}
    </p>
  );
}
