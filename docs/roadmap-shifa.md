# Shifa — Product Direction & Roadmap

Formerly MedFind. Two account types only: **customer** and **pharmacy**.
Single Supabase backend (schema + auth + RLS) is the source of truth; the web
app (Next.js) and the future native Android app (Kotlin/Compose) both consume
the same backend, so updates apply to both.

## Account model

- **Customer** — searches medicines near them, checks reported availability,
  contacts pharmacies, requests reservations (existing behavior).
- **Pharmacy** — does NOT use the customer medicine search. Instead it can:
  1. Manage its own pharmacy profile + reported inventory (existing).
  2. Browse **other pharmacies** and their public info.
  3. From its inventory, search for a product and send a **bulk purchase
     request** to another pharmacy that carries it (B2B).
- **Admin** — verifies pharmacies, manages the catalog, moderates (existing).

## Current state (verified)

- Tier 1 complete: foundation, migrations, Supabase auth, RLS + server RBAC,
  product/pharmacy search (pg_trgm + PostGIS), stock freshness, search UI, map,
  call/navigation, admin pharmacy/product create+verify, tests (49 unit, 8 RLS
  integration, 8 E2E), clean build/typecheck/lint.
- Tier 2 data layer: reservation state machine + API, notifications adapter,
  audit logging, favorites/saved-search/notification schema + RLS.
- Rebrand to **Shifa** applied across source, metadata, docs.
- Native Android app complete (see §3): customer + business flows, business
  dashboard (inventory / suppliers / requests), session persistence — builds
  clean (`./gradlew assembleDebug`).
- Self-serve pharmacy registration assigns the creator as owner via a DB
  trigger (`pharmacies_assign_owner`), shared by web and app.

## Remaining work (in priority order)

### 1. Pharmacy sign-up (self-serve)
- Let a signed-up user register as a pharmacy: create a pharmacy record
  (verification_status = `pending`) and become its `owner`.
- RLS change: allow an authenticated user to INSERT a pharmacy with
  `verification_status = 'pending'` only (still cannot self-verify).
- Server-side creation of the `pharmacy_members` owner row (service role), or a
  scoped RLS policy.
- UI: account-type choice on sign-up + a "set up your pharmacy" form.

### 2. B2B bulk purchase flow (pharmacy → pharmacy)
- New table `purchase_requests` (buyer_pharmacy_id, seller_pharmacy_id,
  product_id, quantity, status, notes, timestamps) + RLS + state machine
  (REQUESTED → ACCEPTED / REJECTED / CANCELLED), mirroring reservations.
- Pharmacy "find suppliers" screen: search products across other pharmacies'
  inventory, view seller info, send a bulk request.
- Seller pharmacy sees inbound requests and accepts/rejects.

### 3. Native Android app (Kotlin + Jetpack Compose) — DONE
- `android/` Gradle project: Compose + Retrofit/Gson/OkHttp hitting the same
  Supabase backend (auth via GoTrue REST, data via PostgREST).
- Session persisted in SharedPreferences with automatic GoTrue token refresh.
- Screens: sign in / sign up (Customer + Business toggle), "set up your
  pharmacy" form (self-serve pending registration), customer pharmacy browse +
  name search, business dashboard (inventory search/add/stock status, "find
  suppliers" bulk purchase, incoming/outgoing purchase requests with
  accept/reject/cancel).
- `./gradlew assembleDebug` produces a working APK (verified: BUILD SUCCESSFUL).

### 4. Polish
- PWA manifest + service worker (installable from browser).
- Customer/pharmacy dashboards and admin panel UI (APIs already exist).
