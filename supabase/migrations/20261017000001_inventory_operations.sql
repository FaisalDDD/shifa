-- Private operational ledger for Shifa Pro. The public pharmacy_inventory
-- table remains a quantity/availability projection without lot costs.
create table if not exists public.pharmacy_inventory_events (
  id uuid not null,
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (pharmacy_id, id)
);

alter table public.pharmacy_inventory_events enable row level security;
create policy inventory_events_select_member on public.pharmacy_inventory_events
  for select using (public.is_admin() or public.is_pharmacy_member(pharmacy_id));
revoke insert, update, delete on public.pharmacy_inventory_events from anon, authenticated;
grant select on public.pharmacy_inventory_events to authenticated;

create or replace function public.apply_pharmacy_inventory_event(
  p_pharmacy_id uuid,
  p_event_id uuid,
  p_event_type text,
  p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  line jsonb;
  delta integer;
  product uuid;
  inserted_count integer;
begin
  if not (public.is_admin() or public.is_pharmacy_member(p_pharmacy_id)) then
    raise exception 'Not authorized for this pharmacy';
  end if;
  if p_event_type not in ('sale', 'receipt', 'adjustment') then
    raise exception 'Unsupported inventory event type';
  end if;

  insert into public.pharmacy_inventory_events(id, pharmacy_id, event_type, payload)
    values (p_event_id, p_pharmacy_id, p_event_type, p_payload)
    on conflict (pharmacy_id, id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return jsonb_build_object('applied', false, 'duplicate', true);
  end if;

  for line in select value from jsonb_array_elements(coalesce(p_payload->'lines', '[]'::jsonb))
  loop
    product := (line->>'product_id')::uuid;
    delta := (line->>'quantity_delta')::integer;
    if delta = 0 then continue; end if;
    insert into public.pharmacy_inventory as current_inventory(pharmacy_id, product_id, quantity, availability_status,
      source, last_updated_at, last_verified_at, updated_by)
    values (p_pharmacy_id, product, delta,
      case when delta > 0 then 'AVAILABLE'::public.availability_status else 'OUT_OF_STOCK'::public.availability_status end,
      'PHARMACY_MANUAL'::public.stock_source, now(), now(), auth.uid())
    on conflict (pharmacy_id, product_id) do update set
      quantity = coalesce(current_inventory.quantity, 0) + excluded.quantity,
      availability_status = case when coalesce(current_inventory.quantity, 0) + excluded.quantity > 0
        then 'AVAILABLE'::public.availability_status else 'OUT_OF_STOCK'::public.availability_status end,
      last_updated_at = now(), last_verified_at = now(), updated_by = auth.uid();
  end loop;
  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;
revoke all on function public.apply_pharmacy_inventory_event(uuid, uuid, text, jsonb) from public;
grant execute on function public.apply_pharmacy_inventory_event(uuid, uuid, text, jsonb) to authenticated;

create table if not exists public.pharmacy_daily_exchange_rates (
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  business_date date not null,
  sdg_per_usd numeric(18, 6) not null check (sdg_per_usd > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (pharmacy_id, business_date)
);
create table if not exists public.pharmacy_exchange_rate_events (
  id uuid not null,
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  business_date date not null,
  sdg_per_usd numeric(18, 6) not null check (sdg_per_usd > 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key (pharmacy_id, id)
);
alter table public.pharmacy_daily_exchange_rates enable row level security;
alter table public.pharmacy_exchange_rate_events enable row level security;
create policy daily_rates_select_member on public.pharmacy_daily_exchange_rates
  for select using (public.is_admin() or public.is_pharmacy_member(pharmacy_id));
create policy rate_events_select_member on public.pharmacy_exchange_rate_events
  for select using (public.is_admin() or public.is_pharmacy_member(pharmacy_id));
revoke insert, update, delete on public.pharmacy_daily_exchange_rates, public.pharmacy_exchange_rate_events from anon, authenticated;
grant select on public.pharmacy_daily_exchange_rates, public.pharmacy_exchange_rate_events to authenticated;

create or replace function public.set_pharmacy_daily_exchange_rate(
  p_pharmacy_id uuid, p_event_id uuid, p_business_date date, p_sdg_per_usd numeric
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare inserted_count integer;
begin
  if not (public.is_admin() or public.is_pharmacy_member(p_pharmacy_id)) then
    raise exception 'Not authorized for this pharmacy';
  end if;
  if p_sdg_per_usd <= 0 then raise exception 'Exchange rate must be positive'; end if;
  insert into public.pharmacy_exchange_rate_events(id, pharmacy_id, business_date, sdg_per_usd, created_by)
    values (p_event_id, p_pharmacy_id, p_business_date, p_sdg_per_usd, auth.uid())
    on conflict (pharmacy_id, id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return jsonb_build_object('applied', false, 'duplicate', true); end if;
  insert into public.pharmacy_daily_exchange_rates(pharmacy_id, business_date, sdg_per_usd, updated_at, updated_by)
    values (p_pharmacy_id, p_business_date, p_sdg_per_usd, now(), auth.uid())
    on conflict (pharmacy_id, business_date) do update set sdg_per_usd=excluded.sdg_per_usd,
      updated_at=now(), updated_by=auth.uid();
  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;
revoke all on function public.set_pharmacy_daily_exchange_rate(uuid, uuid, date, numeric) from public;
grant execute on function public.set_pharmacy_daily_exchange_rate(uuid, uuid, date, numeric) to authenticated;
