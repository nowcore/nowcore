import { defineConfig } from 'prisma/config';

/**
 * Where the migration commands find a database (Prisma 7).
 *
 * Nothing here is read at runtime: the client is handed a driver adapter by
 * the process that constructs it. The default is the local Postgres from
 * infra/docker-compose.yml — the wrong credentials for any other server, so a
 * stray `migrate` fails to authenticate rather than finding someone else's.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url:
      process.env['DATABASE_URL'] ??
      'postgresql://nowcore:nowcore@localhost:5433/nowcore',
  },
});
