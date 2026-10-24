-- Customer-facing stock availability projection and configurable thresholds.
-- The enum value is added in the preceding migration so this migration can use it.

alter table public.pharmacy_inventory
  add column if not exists low_stock_threshold integer not null default 5
    check (low_stock_threshold >= 0 and low_stock_threshold <= 1000000);

update public.pharmacy_inventory
set availability_status = case
  when coalesce(quantity, 0) <= 0 then 'OUT_OF_STOCK'::public.availability_status
  when coalesce(quantity, 0) <= low_stock_threshold then 'LOW_STOCK'::public.availability_status
  else 'AVAILABLE'::public.availability_status
end
where quantity is not null and availability_status <> 'UNKNOWN';

create or replace function public.project_inventory_availability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quantity is not null and new.availability_status <> 'UNKNOWN' then
    new.availability_status := case
      when new.quantity <= 0 then 'OUT_OF_STOCK'::public.availability_status
      when new.quantity <= new.low_stock_threshold then 'LOW_STOCK'::public.availability_status
      else 'AVAILABLE'::public.availability_status
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists pharmacy_inventory_project_availability on public.pharmacy_inventory;
create trigger pharmacy_inventory_project_availability
  before insert or update of quantity, low_stock_threshold, availability_status
  on public.pharmacy_inventory
  for each row execute function public.project_inventory_availability();

create or replace function public.apply_pharmacy_inventory_event(
  p_pharmacy_id uuid,
  p_event_id uuid,
  p_event_type text,
  p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  line jsonb;
  delta integer;
  product uuid;
  inserted_count integer;
  threshold integer;
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
    select low_stock_threshold into threshold
      from public.pharmacy_inventory
      where pharmacy_id = p_pharmacy_id and product_id = product;
    threshold := coalesce(threshold, 5);

    insert into public.pharmacy_inventory as current_inventory(
      pharmacy_id, product_id, quantity, low_stock_threshold, availability_status,
      source, last_updated_at, last_verified_at, updated_by
    ) values (
      p_pharmacy_id, product, delta, threshold,
      case
        when delta <= 0 then 'OUT_OF_STOCK'::public.availability_status
        when delta <= threshold then 'LOW_STOCK'::public.availability_status
        else 'AVAILABLE'::public.availability_status
      end,
      'PHARMACY_MANUAL'::public.stock_source, now(), now(), auth.uid()
    )
    on conflict (pharmacy_id, product_id) do update set
      quantity = coalesce(current_inventory.quantity, 0) + excluded.quantity,
      last_updated_at = now(), last_verified_at = now(), updated_by = auth.uid();
  end loop;
  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;

revoke all on function public.apply_pharmacy_inventory_event(uuid, uuid, text, jsonb) from public;
grant execute on function public.apply_pharmacy_inventory_event(uuid, uuid, text, jsonb) to authenticated;

create or replace view public.pharmacy_inventory_public as
select
  id, pharmacy_id, product_id, availability_status, price, currency,
  last_updated_at, last_verified_at, expires_at, created_at
from public.pharmacy_inventory;

grant select on public.pharmacy_inventory_public to anon, authenticated;

comment on view public.pharmacy_inventory_public is
  'Customer-safe availability projection. Exact operational quantities are not exposed.';
