# Shifa

**Find your pharmacy. Know before you go.**

Shifa helps users locate nearby pharmacies, search for medicines and healthcare
products, check *reported* stock availability and its last verification time,
contact pharmacies, and request reservations. It is a pharmacy **discovery**
service — not a medical service. It does not diagnose conditions, recommend
treatments, or substitute medicines, and reported availability is never a
guarantee of stock.

---

## Stack

- **Frontend/Backend:** Next.js 16 (App Router, TypeScript, React 19)
- **Styling:** Tailwind CSS 4
- **Database/Auth:** Supabase (PostgreSQL + PostGIS, Supabase Auth, RLS)
- **Maps:** Leaflet + react-leaflet with a licensed tile provider (configurable)
- **Validation:** Zod
- **Testing:** Vitest (unit + integration), Playwright (E2E)

## Features (current state)

- **Tier 1 (complete, tested):** project foundation, migrations, Supabase auth
  flows, server-side + RLS role-based access control, product catalog + search
  (pg_trgm, typo-tolerant), pharmacy catalog + PostGIS geo search, stock
  availability model with freshness states, search UI (autocomplete/filters/
  map+list), pharmacy map with clustering, call/navigation actions, admin
  pharmacy/product create+verify, core unit + authorization integration tests.
- **Tier 2 (data layer complete; dashboards UI not yet built):** reservation
  state machine (transactions + expiration via trigger/service), reservation
  API, favorites/saved-search/notification schema + RLS, email notification
  adapter (degrades to log when unconfigured), audit logging.
- **Tier 3 (not implemented):** CSV bulk import, analytics dashboard, push
  notifications, barcode scanning.

See `IMPLEMENTATION_PLAN.md` and the final implementation report for details.

---

## Required software

- Node.js **20.9+** (tested on 24.x)
- npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local dev / migrations)
- Docker (for `supabase start`, local stack)

## Install dependencies

```bash
npm install
```

## Create the database project

**Local development** (recommended): run a local Supabase stack with Docker.

```bash
supabase init          # first time only (creates supabase/config.toml)
supabase start         # starts Postgres + PostGIS, Auth, REST, Studio
```

**Production**: create a project at https://supabase.com and copy the project
URL, anon key and service-role key into `.env.local`.

## Configure authentication

Supabase Auth is used directly. In the Supabase dashboard → Authentication:

1. Enable the **Email** provider.
2. For local dev you can disable "Confirm email" to avoid waiting for email;
   in production enable it and configure SMTP (see below).
3. Add your production URL to **Authentication → URL Configuration** (Site URL
   and Redirect URLs), e.g. `https://yourdomain.com/**` and
   `https://yourdomain.com/auth/callback`.

## Running database migrations

```bash
# Local: apply migrations + seed (recreates the local DB)
supabase db reset

# Production: push migrations to the linked remote project
supabase link --project-ref <ref>
supabase db push
```

Migrations live in `supabase/migrations/` and are applied in filename order.

## Setting environment variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

Required for the app to run:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-only) |

Optional but recommended in production:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_MAP_TILE_URL` | Leaflet tile URL template (licensed provider) |
| `NEXT_PUBLIC_MAP_TILE_API_KEY` | Tile provider API key |
| `EMAIL_PROVIDER_API_KEY` | Enables email notifications (Resend) |
| `APP_BASE_URL` | Canonical app URL |
| `INCLUDE_DEMO_DATA` | Set `false` in production to hide demo records |
| `ADMIN_BOOTSTRAP_TOKEN` | One-time secret for `create-admin` |

## Starting the application locally

```bash
npm run dev        # http://localhost:3000
```

## Running automated tests

```bash
npm run test:unit          # business-logic unit tests (no DB needed)
npm run test:integration   # RLS/authorization tests (needs local Supabase)
npm run test               # both
npm run test:e2e           # Playwright (needs the app running)
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint
```

Integration tests read `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
and `SUPABASE_SERVICE_ROLE_KEY` from the environment and skip cleanly if absent.

## Building for production

```bash
npm run build
npm start
```

## Deploying the application

Full step-by-step instructions (Vercel + Supabase, plus a rollback procedure and
database backup recommendations) are in [`docs/deployment.md`](docs/deployment.md).

## Creating the first administrator

There is **no** default admin account. Create one securely:

1. Set a strong random secret: `export ADMIN_BOOTSTRAP_TOKEN="<random>"`
2. Sign up for a normal account in the app.
3. Run:

```bash
npm run create-admin -- --email=admin@example.com --token="<random>"
```

The script verifies the token against `ADMIN_BOOTSTRAP_TOKEN`, then promotes the
account to `admin` using the service-role key.

## Backing up the database

- **Supabase:** enable automatic backups (Pro plan) and/or run `supabase db dump`
  for a manual SQL dump.
- **Local:** `supabase db dump -f backup.sql`.

## Troubleshooting common deployment failures

- **Build fails "Missing required environment variable"** — set the variables in
  `.env.local` (local) or the platform's environment settings (production).
- **Auth callback redirects to `/auth/error`** — the Site URL / Redirect URLs in
  Supabase Auth don't include your domain; update them.
- **Map is blank / "Map tiles are not configured"** — set
  `NEXT_PUBLIC_MAP_TILE_URL` and (if needed) `NEXT_PUBLIC_MAP_TILE_API_KEY`.
  Do **not** point it at the default OpenStreetMap tile server.
- **Migrations fail** — ensure the Supabase CLI version matches and Docker is
  running for `supabase start`; run `supabase db reset` to reset local state.
- **Email notifications not arriving** — `EMAIL_PROVIDER_API_KEY` is unset, so
  delivery is logged instead (intentional degradation). Set the key to activate.

## More documentation

- [`docs/setup.md`](docs/setup.md) — detailed local development setup
- [`docs/deployment.md`](docs/deployment.md) — production deployment + rollback
- [`docs/api.md`](docs/api.md) — API reference
