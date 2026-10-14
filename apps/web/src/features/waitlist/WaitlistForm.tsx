'use client';
import { useActionState } from 'react';
import { joinWaitlist, type JoinResult } from './actions';

const mono = 'font-mono text-[11px] uppercase tracking-[0.18em]';

export function WaitlistForm() {
  const [result, action, pending] = useActionState<JoinResult, FormData>(
    joinWaitlist,
    null,
  );
  if (result?.ok) {
    return (
      <p
        role="status"
        className="flex-[1_1_380px] border-b border-steel pb-3 text-[17px] text-paper"
      >
        {result.message}
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-[1_1_380px] flex-col gap-3.5">
      <label htmlFor="nc-email" className={`${mono} text-smoke`}>
        Drop alerts
      </label>
      <div className="flex items-center gap-3 border-b border-steel pb-3">
        <input
          id="nc-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={result && !result.ok ? true : undefined}
          aria-describedby={result && !result.ok ? 'nc-email-err' : undefined}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[17px] text-paper outline-none placeholder:text-ghost"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-full bg-accent px-[22px] text-sm font-medium text-void disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Notify me'}
        </button>
      </div>
      {result && !result.ok ? (
        <p id="nc-email-err" role="alert" className="text-xs text-paper">
          {result.message}
        </p>
      ) : (
        <p className="text-xs text-ghost">
          One message per drop. Nothing else, ever.
        </p>
      )}
    </form>
  );
}
