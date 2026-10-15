#!/usr/bin/env sh
# Operations on the hosted Supabase project, reading .env.supabase (gitignored).
#
#   tools/supabase.sh migrate      apply prisma migrations (session pooler, DIRECT_URL)
#   tools/supabase.sh buckets      create / correct the storage buckets
#   tools/supabase.sh admin        create the operator from SEED_ADMIN_* (no demo catalogue)
#   tools/supabase.sh check        connection, tables, row-level security, buckets — prints no secrets
#
# Local development and every test use the local Postgres; nothing here runs
# against Supabase unless you call it.
set -eu
cd "$(dirname "$0")/.."
[ -f .env.supabase ] || { echo ".env.supabase not found at the repo root" >&2; exit 1; }
set -a; . ./.env.supabase; set +a
redact() { sed -E 's#postgres(ql)?://[^ "]+#<url>#g'; }

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
  *)
    sed -n '2,9p' "$0"; exit 1 ;;
esac
