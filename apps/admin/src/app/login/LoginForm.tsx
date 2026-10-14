'use client';
import { useActionState } from 'react';
import { signIn } from './actions';

const field =
  'min-h-11 w-full rounded border border-steel bg-ash px-3 text-sm text-paper outline-none focus:border-paper/50';

export function LoginForm({ expired }: { expired: boolean }) {
  const [error, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      {(error || expired) && (
        <p
          role="alert"
          className="rounded border border-steel px-3 py-2 text-sm text-paper"
        >
          {error ?? 'Your session ended. Sign in again.'}
        </p>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-smoke">
          Email
        </span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-smoke">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded bg-paper text-sm font-medium text-void disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
