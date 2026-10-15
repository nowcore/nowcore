-- Supabase publishes every table in `public` through its Data API, and the
-- key that opens it (the publishable/anon key) is public by design. Prisma
-- creates tables with row-level security off, so on 15 Oct 2026 the hosted
-- project answered /rest/v1/orders and /rest/v1/operators to anyone (the
-- tables were still empty). With RLS on and no policies, the API roles see
-- nothing. The API and the worker connect as the tables' owner, which RLS
-- does not apply to (ADR-003: they are the only readers and writers).
--
-- Every future table must do the same; apps/api rls.spec.ts fails otherwise.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
