#!/usr/bin/env sh
# Operations on the hosted Supabase project, reading .env.supabase (gitignored).
#
#   tools/supabase.sh migrate      apply prisma migrations (session pooler, DIRECT_URL)
#   tools/supabase.sh buckets      create / correct the storage buckets
#   tools/supabase.sh admin        create the operator from SEED_ADMIN_* (no demo catalogue)
#   tools/supabase.sh check        connection, tables, row-level security, buckets — prints no secrets
#   tools/supabase.sh run          API + worker + admin + storefront on THIS machine, against the hosted
#                                  database and storage — for authoring real drops before deployment.
#                                  Payments are still fake here: do not place orders.
#
# Local development and every test use the local Postgres; nothing here runs
# against Supabase unless you call it.
set -eu
cd "$(dirname "$0")/.."
[ -f .env.supabase ] || { echo ".env.supabase not found at the repo root" >&2; exit 1; }
set -a; . ./.env.supabase; set +a
redact() { sed -l -E 's#postgres(ql)?://[^ "]+#<url>#g'; }

case "${1:-}" in
  migrate)
    (cd libs/db && DATABASE_URL="$DIRECT_URL" pnpm exec prisma migrate deploy) 2>&1 | redact ;;
  buckets)
    node tools/supabase-setup.mjs ;;
  admin)
    (cd libs/db && DATABASE_URL="$DIRECT_URL" ADMIN_EMAIL="$SEED_ADMIN_EMAIL" \
      ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" SEED_CATALOGUE=off node prisma/seed.ts) 2>&1 | redact ;;
  check)
    (cd apps/api && node -e '
      const fs = require("fs");
      const { Client } = require(require.resolve("pg", { paths: [fs.realpathSync("node_modules/@prisma/adapter-pg")] }));
      (async () => {
        const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
        await c.connect();
        const t = (await c.query("select count(*)::int n, count(*) filter (where not rowsecurity)::int off from pg_tables where schemaname = $1", ["public"])).rows[0];
        const m = (await c.query("select count(*)::int n from _prisma_migrations where finished_at is not null")).rows[0];
        const o = (await c.query("select count(*)::int n from operators")).rows[0];
        console.log(`database   ${t.n} tables, row-level security off on ${t.off}; ${m.n} migrations; ${o.n} operator(s)`);
        await c.end();
        const r = await fetch(process.env.SUPABASE_URL + "/storage/v1/bucket", { headers: { apikey: process.env.SUPABASE_SECRET_KEY, authorization: "Bearer " + process.env.SUPABASE_SECRET_KEY } });
        const b = await r.json();
        console.log("storage    " + b.map((x) => x.id + (x.public ? " (public)" : " (private)")).join(", "));
      })().catch((e) => { console.error(e.message.replace(/postgres(ql)?:\/\/[^ ]+/g, "<url>")); process.exit(1); });') ;;
  run)
    for port in 3000 3001 4100; do
      if lsof -iTCP:$port -sTCP:LISTEN -t >/dev/null 2>&1; then echo "port $port is in use — stop pnpm dev first" >&2; exit 1; fi
    done
    pnpm exec nx run-many -t build -p api worker >/dev/null
    # The hosted queue prefix keeps these jobs away from a local dev worker, and the other way round.
    export STORAGE=supabase QUEUE_PREFIX=hosted
    trap 'kill 0' INT TERM EXIT
    (cd apps/api && PORT=4100 ASSET_BASE_URL="$SUPABASE_URL/storage/v1/object/public" node dist/main.js 2>&1 | redact | sed -l 's/^/[api] /') &
    (cd apps/worker && node dist/main.js 2>&1 | redact | sed -l 's/^/[worker] /') &
    (unset DATABASE_URL DIRECT_URL SUPABASE_SECRET_KEY; pnpm --dir apps/admin exec next dev --port 3001 2>&1 | sed -l 's/^/[admin] /') &
    (unset DATABASE_URL DIRECT_URL SUPABASE_SECRET_KEY; pnpm --dir apps/web exec next dev --port 3000 2>&1 | sed -l 's/^/[web] /') &
    echo "admin http://localhost:3001  ·  storefront http://localhost:3000  ·  hosted database + Supabase storage  ·  Ctrl-C stops all"
    wait ;;
  *)
    sed -n '2,12p' "$0"; exit 1 ;;
esac
