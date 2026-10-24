-- MedFind — core schema
-- All timestamps are stored in UTC (timestamptz). See README for timezone notes.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('customer', 'pharmacy_staff', 'admin');
create type public.verification_status as enum ('pending', 'verified', 'rejected', 'suspended');
create type public.membership_role as enum ('owner', 'staff');
create type public.availability_status as enum ('AVAILABLE', 'OUT_OF_STOCK', 'UNKNOWN');
create type public.stock_source as enum (
  'PHARMACY_MANUAL',
  'VERIFIED_INVENTORY_INTEGRATION',
  'USER_REPORT',
  'ADMIN_CORRECTION'
);
create type public.reservation_status as enum (
  'REQUESTED', 'CONFIRMED', 'REJECTED', 'FULFILLED', 'CANCELLED', 'EXPIRED'
);
create type public.prescription_classification as enum ('otc', 'prescription', 'unknown');
create type public.report_status as enum ('open', 'reviewed', 'dismissed');

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pharmacies
-- ---------------------------------------------------------------------------

create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  address text not null,
  city text,
  postal_code text,
  country_code text,
  latitude double precision not null,
  longitude double precision not null,
  location geography (Point, 4326),
  phone text,
  website text,
  verification_status public.verification_status not null default 'pending',
  is_active boolean not null default true,
  is_demo boolean not null default false,
  opening_hours jsonb,
  services text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pharmacies_location_idx on public.pharmacies using gist (location);
create index pharmacies_verification_idx on public.pharmacies (verification_status);
create index pharmacies_active_idx on public.pharmacies (is_active);
create index pharmacies_slug_idx on public.pharmacies (slug);

-- ---------------------------------------------------------------------------
-- pharmacy_members (staff authorization)
-- ---------------------------------------------------------------------------

create table public.pharmacy_members (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  membership_role public.membership_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (pharmacy_id, user_id)
);

create index pharmacy_members_user_idx on public.pharmacy_members (user_id);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  brand_name text,
  strength text,
  dosage_form text,
  barcode text,
  product_identifier text,
  prescription_classification public.prescription_classification not null default 'unknown',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_canonical_trgm_idx on public.products using gin (canonical_name gin_trgm_ops);
create index products_brand_idx on public.products (brand_name);
create index products_barcode_idx on public.products (barcode);
create index products_identifier_idx on public.products (product_identifier);

create table public.product_active_ingredients (
  product_id uuid not null references public.products (id) on delete cascade,
  active_ingredient text not null,
  primary key (product_id, active_ingredient)
);

create index product_active_ingredients_ingredient_idx
  on public.product_active_ingredients (active_ingredient);

-- ---------------------------------------------------------------------------
-- pharmacy_inventory (stock availability)
-- ---------------------------------------------------------------------------

create table public.pharmacy_inventory (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  availability_status public.availability_status not null default 'UNKNOWN',
  quantity integer,
  price numeric(12, 2),
  currency text,
  source public.stock_source not null default 'PHARMACY_MANUAL',
  last_updated_at timestamptz not null default now(),
  last_verified_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pharmacy_id, product_id)
);

create index pharmacy_inventory_pharmacy_idx on public.pharmacy_inventory (pharmacy_id);
create index pharmacy_inventory_product_idx on public.pharmacy_inventory (product_id);
create index pharmacy_inventory_status_idx on public.pharmacy_inventory (availability_status);

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status public.reservation_status not null default 'REQUESTED',
  request_notes text,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  expires_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reservations_customer_idx on public.reservations (customer_id, created_at desc);
create index reservations_pharmacy_idx on public.reservations (pharmacy_id, status, created_at desc);
create index reservations_status_idx on public.reservations (status, expires_at);

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, pharmacy_id)
);

create index favorites_user_idx on public.favorites (user_id);

-- ---------------------------------------------------------------------------
-- saved_searches
-- ---------------------------------------------------------------------------

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  normalized_query text not null,
  product_id uuid references public.products (id) on delete set null,
  notification_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_searches_user_idx on public.saved_searches (user_id);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- stock_reports
-- ---------------------------------------------------------------------------

create table public.stock_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles (id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  reported_status public.availability_status not null,
  report_status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index stock_reports_status_idx on public.stock_reports (report_status, created_at);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
