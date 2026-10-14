'use client';
import { useActionState, useState } from 'react';
import { accentProblems, SIGNAL } from '@nowcore/shared/color';
import { createDrop, type CreateResult } from '../actions';

const field =
  'min-h-10 w-full rounded border border-steel bg-ash px-3 text-[13px] text-paper outline-none focus:border-paper/40';
const label = 'font-mono text-[9px] uppercase tracking-[0.18em] text-smoke';
const BLANKS = [
  ['blk', 'Void black'],
  ['bone', 'Bone'],
  ['ash', 'Ash grey'],
  ['moss', 'Deep moss'],
] as const;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/**
 * New drop (T-064). The accent is checked live with the same contrast maths
 * the publish check runs on the server (@nowcore/shared/color), so an
 * unreadable accent is caught while choosing it, not at publish time.
 */
export function NewDropForm({ nextNumber }: { nextNumber: number }) {
  const [result, action, pending] = useActionState<CreateResult, FormData>(
    createDrop,
    null,
  );
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [accent, setAccent] = useState<string>(SIGNAL);
  const valid = /^#[0-9A-Fa-f]{6}$/.test(accent);
  const problems = valid ? accentProblems(accent) : ['six-digit hex, #RRGGBB'];
  const err = (k: string) =>
    result?.fields[k] && (
      <span className="text-xs text-bad">{result.fields[k]}</span>
    );

  return (
    <form action={action} className="flex max-w-[640px] flex-col gap-5">
      {result && (
        <p
          role="alert"
          className="rounded border border-bad/40 px-3 py-2 text-sm"
        >
          {result.message}
        </p>
      )}
      <div className="grid grid-cols-[100px_1fr] gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Number</span>
          <input
            name="number"
            type="number"
            min={1}
            max={999}
            defaultValue={nextNumber}
            required
            className={field}
          />
          {err('number')}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Title</span>
          <input
            name="title"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className={field}
          />
          {err('title')}
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Slug — the drop&apos;s URL</span>
        <input
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          className={`${field} font-mono`}
        />
        {err('slug')}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Description</span>
        <textarea
          name="description"
          required
          rows={3}
          className={`${field} py-2`}
        />
        {err('description')}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${label} mb-1.5`}>
          Accent — re-tints the whole site while this drop is live
        </legend>
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Pick accent"
            value={valid ? accent : SIGNAL}
            onChange={(e) => setAccent(e.target.value.toUpperCase())}
            className="h-10 w-12 rounded border border-steel bg-ash"
          />
          <input
            name="accentColor"
            aria-label="Accent hex"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className={`${field} max-w-[140px] font-mono`}
          />
          <span
            className="inline-flex min-h-10 items-center rounded-full px-5 text-sm font-medium"
            style={
              valid ? { background: accent, color: 'var(--void)' } : undefined
            }
          >
            Take it ↗
          </span>
        </div>
        <p
          role="status"
          className={`text-xs ${problems.length ? 'text-warn' : 'text-ok'}`}
        >
          {problems.length
            ? problems.join('; ')
            : 'Readable on the void and under button text.'}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${label} mb-1.5`}>Colourways</legend>
        <div className="flex flex-wrap gap-3">
          {BLANKS.map(([code, name], i) => (
            <label
              key={code}
              className="inline-flex min-h-10 items-center gap-2 rounded border border-steel px-3"
            >
              <input
                type="checkbox"
                name="colourways"
                value={code}
                defaultChecked={i === 0}
              />
              {name}
            </label>
          ))}
        </div>
        {err('colourways')}
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Price, ₹ (incl. GST)</span>
          <input
            name="price"
            type="number"
            min={100}
            step={1}
            defaultValue={799}
            required
            className={field}
          />
          <span className="text-xs text-ghost">2XL and 3XL add ₹50.</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Edition size (blank = open)</span>
          <input
            name="editionSize"
            type="number"
            min={1}
            defaultValue={500}
            className={field}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-10 self-start rounded bg-paper px-5 text-sm font-medium text-void disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create draft'}
      </button>
    </form>
  );
}
