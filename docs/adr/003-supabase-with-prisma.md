# ADR-003 — Supabase with Prisma; the API is the only writer

**Status:** Accepted, 13 Oct 2026

**Context.** The operator specified Supabase. The house convention (`classroom-metaverse`) is Prisma
with NestJS.

**Decision.** Supabase provides Postgres, Auth (phone OTP), Storage (artwork, frame sequences) and
Realtime (admin order board). Prisma is the ORM and owns migrations. Only `apps/api` and `apps/worker`
write to the database, via the service role. RLS only for the few tables a client reads directly.

**Why.** One managed service instead of four; authorization in one testable place.

**Consequences.** Supabase's auto-generated REST and client-side writes are unused by design. Prisma
migrations, not the Supabase dashboard, are the schema's source of truth.

**Alternatives rejected.** Drizzle (good, breaks convention for no gain). Supabase client as ORM (no
migrations or transactions worth the name). RLS everywhere (policy sprawl, untestable, slow joins).
