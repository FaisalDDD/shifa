-- Delivery settings for customers, automatic row creation, and expiry cleanup.

create or replace function public.ensure_pharmacy_delivery_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pharmacy_delivery_settings(pharmacy_id)
  values (new.id)
  on conflict (pharmacy_id) do nothing;
  return new;
end;
$$;

drop trigger if exists pharmacies_delivery_settings on public.pharmacies;
create trigger pharmacies_delivery_settings
after insert on public.pharmacies
for each row execute function public.ensure_pharmacy_delivery_settings();

create or replace view public.pharmacy_delivery_settings_public as
select pharmacy_id, enabled, delivery_fee, bank_name
from public.pharmacy_delivery_settings
where enabled = true;

grant select on public.pharmacy_delivery_settings_public to anon, authenticated;

-- Bank account details are no longer public. Only the customer of an order,
-- or the pharmacy's staff/admin, may read the account details needed to pay.
create or replace function public.get_delivery_payment_details(p_order_id uuid)
returns table (
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  transfer_instructions text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.delivery_orders%rowtype;
begin
  select * into order_row from public.delivery_orders where id = p_order_id;
  if not found then raise exception 'Delivery order not found'; end if;
  if not (auth.uid() = order_row.customer_id
          or public.is_admin()
          or public.is_pharmacy_member(order_row.pharmacy_id)) then
    raise exception 'Not authorized for this order';
  end if;
  return query
    select s.bank_name, s.bank_account_name, s.bank_account_number, s.transfer_instructions
    from public.pharmacy_delivery_settings s
    where s.pharmacy_id = order_row.pharmacy_id;
end;
$$;

revoke all on function public.get_delivery_payment_details(uuid) from public;
grant execute on function public.get_delivery_payment_details(uuid) to authenticated;

create or replace function public.expire_delivery_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.delivery_orders
  set status='EXPIRED', updated_at=now()
  where status='ACCEPTED' and expires_at is not null and expires_at <= now();
  get diagnostics expired_count = row_count;

  update public.reservations r
  set status='CANCELLED', cancelled_at=now(), updated_at=now()
  where r.status='CONFIRMED'
    and r.expires_at is not null and r.expires_at <= now()
    and r.request_notes like 'Delivery order %';

  insert into public.delivery_order_events(order_id,event_type,note)
  select id,'EXPIRED','Order expired and its reservations were released.'
  from public.delivery_orders
  where status='EXPIRED'
    and updated_at >= now() - interval '1 minute'
    and not exists (
      select 1 from public.delivery_order_events e
      where e.order_id=delivery_orders.id and e.event_type='EXPIRED'
    );
  return expired_count;
end;
$$;

revoke all on function public.expire_delivery_orders() from public;
grant execute on function public.expire_delivery_orders() to service_role;
