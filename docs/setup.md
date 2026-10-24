# Local Development Setup

## 1. Prerequisites

- Node.js 20.9+ (tested on 24.x), npm
- Docker Desktop (running)
- Supabase CLI: `npm install -g supabase`

## 2. Install and start the local stack

```bash
npm install
supabase start            # first run pulls images; may take several minutes
```

This starts Postgres (with PostGIS, pg_trgm, pgcrypto), Supabase Auth, PostgREST,
and Studio. Note the local API URL is `http://127.0.0.1:54321` and Studio is
`http://127.0.0.1:54323`.

## 3. Environment variables

```bash
cp .env.example .env.local
```

For local dev, the demo anon/service-role keys are fixed by Supabase; see
`supabase status -o env`. A working `.env.local` looks like:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service role key from supabase status>
APP_BASE_URL=http://localhost:3000
INCLUDE_DEMO_DATA=true
ADMIN_BOOTSTRAP_TOKEN=local-dev-secret
```

## 4. Apply migrations and seed

```bash
supabase db reset          # applies supabase/migrations/*.sql then supabase/seed.sql
```

This seeds a clearly-labeled demo catalog (36 products), 9 fictional pharmacies
(all `is_demo = true`), and sample inventory with varied availability statuses
and freshness timestamps.

## 5. Run the app

```bash
npm run dev               # http://localhost:3000
```

## 6. Create the first admin

```bash
# 1. sign up for an account in the UI (or Studio → Authentication → Add user)
# 2. promote it:
npm run create-admin -- --email=you@example.com --token=local-dev-secret
```

## 7. Run tests

```bash
npm run test:unit         # no DB required
npm run test:integration  # RLS tests against the local Supabase
npm run typecheck
npm run lint
```

## 8. Reset everything

```bash
supabase db reset          # re-applies migrations + seed
supabase stop              # stop the stack
```

## Notes

- Demo products/pharmacies are flagged `is_demo = true`. Read paths include them
  only when `INCLUDE_DEMO_DATA` is not `false`, so production (which ships an
  empty catalog) never shows demo data.
- `supabase db reset` re-runs the seed file; it does not create any
  demonstration admin accounts.
