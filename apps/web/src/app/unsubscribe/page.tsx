import type { Metadata } from 'next';
import { leaveList } from '../../features/waitlist/actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Leave the list — NOWCORE',
  robots: { index: false },
};

/**
 * The link in every drop alert. Leaving costs one click — but a click, not a
 * visit: mail scanners open every link in a message, and a GET that
 * unsubscribed would take people off the list who never asked.
 */
export default async function Unsubscribe({
  searchParams,
}: {
  searchParams: Promise<{
    e?: string;
    t?: string;
    done?: string;
    failed?: string;
  }>;
}) {
  const { e, t, done, failed } = await searchParams;
  const [lead, tail, body] = done
    ? [
        'You are',
        'off the list.',
        'No more drop alerts. Sign up again on the homepage whenever you like.',
      ]
    : failed || !e || !t
      ? [
          'That link',
          'did not work.',
          'It may be incomplete. Reply to any alert and we will take you off by hand.',
        ]
      : ['Leave', 'the list?', `No more drop alerts to ${e}.`];
  return (
    <main className="flex min-h-svh flex-col justify-center gap-4 bg-void px-6 font-sans text-paper md:px-16">
      <a href="/" className="text-[22px] font-semibold tracking-tight">
        NOWCORE
      </a>
      <h1 className="leading-[0.96]">
        <span className="block text-[clamp(2.5rem,5vw,3.25rem)] font-medium tracking-[-0.04em]">
          {lead}
        </span>
        <span className="-ml-0.5 block font-serif text-[clamp(2.75rem,5.5vw,3.5rem)] italic">
          {tail}
        </span>
      </h1>
      <p className="max-w-[420px] text-smoke">{body}</p>
      {!done && !failed && e && t && (
        <form action={leaveList}>
          <input type="hidden" name="e" value={e} />
          <input type="hidden" name="t" value={t} />
          <button className="mt-2 rounded-full bg-paper px-6 py-3 font-medium text-void">
            Unsubscribe
          </button>
        </form>
      )}
    </main>
  );
}
