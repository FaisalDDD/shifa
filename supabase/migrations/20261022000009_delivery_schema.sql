-- Delivery orders are optional per pharmacy. Payments are direct bank transfers;
-- receipt uploads never become confirmed payment automatically.

create table public.pharmacy_delivery_settings (
  pharmacy_id uuid primary key references public.pharmacies(id) on delete cascade,
  enabled boolean not null default false,
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  transfer_instructions text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.pharmacy_delivery_settings(pharmacy_id)
select id from public.pharmacies
on conflict (pharmacy_id) do nothing;

create table public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  status public.delivery_order_status not null default 'REQUESTED',
  payment_status public.delivery_payment_status not null default 'PENDING',
  delivery_address text not null,
  contact_phone text not null,
  notes text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  currency text not null default 'SDG',
  receipt_note text,
  payment_reference text,
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  delivered_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index delivery_orders_customer_idx on public.delivery_orders(customer_id, created_at desc);
create index delivery_orders_pharmacy_idx on public.delivery_orders(pharmacy_id, status, created_at desc);

create table public.delivery_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  unique(order_id, product_id)
);

create table public.delivery_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_orders(id) on delete cascade,
  event_type text not null,
  note text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.pharmacy_delivery_settings enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.delivery_order_items enable row level security;
alter table public.delivery_order_events enable row level security;

create policy delivery_settings_select_owner on public.pharmacy_delivery_settings
  for select using (public.is_pharmacy_owner(pharmacy_id));
create policy delivery_settings_update_owner on public.pharmacy_delivery_settings
  for update using (public.is_pharmacy_owner(pharmacy_id))
  with check (public.is_pharmacy_owner(pharmacy_id));

create policy delivery_orders_select_customer_or_member on public.delivery_orders
  for select using (customer_id = auth.uid() or public.is_pharmacy_member(pharmacy_id) or public.is_admin());
create policy delivery_order_items_select_scoped on public.delivery_order_items
  for select using (exists(select 1 from public.delivery_orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_pharmacy_member(o.pharmacy_id) or public.is_admin())));
create policy delivery_order_events_select_scoped on public.delivery_order_events
  for select using (exists(select 1 from public.delivery_orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_pharmacy_member(o.pharmacy_id) or public.is_admin())));

revoke insert, update, delete on public.delivery_orders, public.delivery_order_items, public.delivery_order_events from anon, authenticated;
revoke insert, update, delete on public.pharmacy_delivery_settings from anon, authenticated;
grant select on public.pharmacy_delivery_settings, public.delivery_orders, public.delivery_order_items, public.delivery_order_events to authenticated;
