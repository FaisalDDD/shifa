# Shifa Implementation Plan

## Environment (verified 2026-10-14)

- Node v24.13.0, npm 11.6.2, git 2.53.0 — OK
- Docker 29.1.5 installed, daemon NOT running (Docker Desktop stopped)
- No Supabase CLI, no psql, no pnpm/yarn
- Network access to npmjs registry — OK
- Windows 11 (git-bash shell), 63 GB free disk

## Environment limitations & how they are handled

1. No Supabase credentials → the app is built against Supabase (Auth + Postgres + RLS),
   with full migrations in `supabase/migrations/` and `supabase/seed.sql`. Real Supabase
   setup is documented (docs/setup.md). Tests that need a database run against a local
   Postgres+PostGIS container when available, and skip cleanly otherwise.
2. Docker daemon stopped → attempt to start Docker Desktop to run a `postgis/postgis`
   container for integration tests. If it cannot start, DB integration tests are written
   and skip at runtime with a clear reason.
3. No map tile API key → map tile URL/key are env-configured (NEXT_PUBLIC_MAP_TILE_URL,
   NEXT_PUBLIC_MAP_TILE_API_KEY); the map component renders a neutral "map unavailable"
   state when unconfigured, never the default OSM tile server.

## Phase → brief mapping

- Phase 1 (foundation): §4 stack, §6 roles, §15 schema, §17 security, §21 env/deploy
- Phase 2 (core data): §11 stock model, §12 search, §13 geo, §19 seed/demo data
- Phase 3 (customer UX): §7 public pages, §12 search UI, §13 map
- Phase 4 (pharmacy mgmt): §9 pharmacy dashboard
- Phase 5 (customer accounts): §8 customer dashboard, §14 reservations
- Phase 6 (administration): §10 admin panel
- Phase 7 (quality/deploy): §20 tests, §21 deploy, §28 final report

## Priority

Tier 1 fully working and tested first. Tier 2 second. Tier 3 only if time permits.
DB-dependent verification is attempted via a local PostGIS container; if Docker cannot
start, that subset is explicitly reported as "written but not executed" in the final
report — never claimed as passing.
