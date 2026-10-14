import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in — NOWCORE admin' };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-void px-5 font-sans text-paper">
      <div className="flex w-full max-w-[340px] flex-col gap-6">
        <div>
          <p className="text-[15px] font-semibold">NOWCORE</p>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-smoke">
            Admin
          </p>
        </div>
        <LoginForm expired={expired === '1'} />
      </div>
    </main>
  );
}
