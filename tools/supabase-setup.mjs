/**
 * One-time (and re-runnable) setup of a hosted Supabase project (T-035).
 *
 *   set -a; . ./.env.supabase; set +a; node tools/supabase-setup.mjs
 *
 * Creates the storage buckets if they are missing, and corrects their
 * settings if they drifted. Prints names and settings, never keys.
 * Migrations are separate: DATABASE_URL="$DIRECT_URL" pnpm db:migrate:deploy
 * (see docs/07-setup.md).
 */
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error(
    'SUPABASE_URL and SUPABASE_SECRET_KEY must be set (source .env.supabase first)',
  );
  process.exit(1);
}

const BUCKETS = [
  // Turntable frames and stills: public, read by every browser, immutable per revision.
  {
    id: 'frames',
    public: true,
    file_size_limit: 2 * 1024 * 1024,
    allowed_mime_types: ['image/avif', 'image/png'],
  },
  // Print files: private; only the API (writes) and the worker (reads) touch them.
  {
    id: 'artwork',
    public: false,
    file_size_limit: 10 * 1024 * 1024,
    allowed_mime_types: ['image/png'],
  },
];

const headers = {
  apikey: key,
  authorization: `Bearer ${key}`,
  'content-type': 'application/json',
};
const existing = await (
  await fetch(`${url}/storage/v1/bucket`, { headers })
).json();
if (!Array.isArray(existing)) {
  console.error(
    'could not list buckets:',
    JSON.stringify(existing).slice(0, 200),
  );
  process.exit(1);
}

for (const b of BUCKETS) {
  const found = existing.find((e) => e.id === b.id);
  const body = JSON.stringify({ id: b.id, name: b.id, ...b });
  const res = found
    ? await fetch(`${url}/storage/v1/bucket/${b.id}`, {
        method: 'PUT',
        headers,
        body,
      })
    : await fetch(`${url}/storage/v1/bucket`, {
        method: 'POST',
        headers,
        body,
      });
  console.log(
    `${b.id.padEnd(8)} ${found ? 'updated' : 'created'} (${res.status}) public=${b.public} max=${b.file_size_limit / 1024 / 1024} MB types=${b.allowed_mime_types.join(',')}`,
  );
  if (!res.ok) {
    console.error(await res.text());
    process.exit(1);
  }
}
