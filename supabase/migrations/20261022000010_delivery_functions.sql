create or replace function public.create_delivery_order(
  p_pharmacy_id uuid,
  p_delivery_address text,
  p_contact_phone text,
  p_notes text,
  p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  order_id uuid := gen_random_uuid();
  item jsonb;
  product_id uuid;
  requested_qty integer;
  available_qty integer;
  reserved_qty integer;
  unit_price numeric;
  subtotal numeric := 0;
  delivery_fee numeric := 0;
  is_enabled boolean;
begin
  if auth.uid() is null then raise exception 'Sign in before placing a delivery order'; end if;
  if length(trim(coalesce(p_delivery_address, ''))) < 5 or length(trim(coalesce(p_contact_phone, ''))) < 5 then
    raise exception 'Delivery address and contact phone are required';
  end if;
  select enabled, pharmacy_delivery_settings.delivery_fee
    into is_enabled, delivery_fee
    from public.pharmacy_delivery_settings
    where pharmacy_id = p_pharmacy_id;
  if not coalesce(is_enabled, false) then raise exception 'This pharmacy does not accept delivery orders'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Add at least one product'; end if;

  insert into public.delivery_orders(customer_id, pharmacy_id, delivery_address, contact_phone, notes, subtotal, delivery_fee, total)
    values (auth.uid(), p_pharmacy_id, trim(p_delivery_address), trim(p_contact_phone), nullif(trim(p_notes), ''), 0, delivery_fee, delivery_fee);

  for item in select value from jsonb_array_elements(p_items)
  loop
    product_id := (item->>'product_id')::uuid;
    requested_qty := (item->>'quantity')::integer;
    if requested_qty is null or requested_qty <= 0 then raise exception 'Each delivery quantity must be positive'; end if;
    select quantity, price into available_qty, unit_price
      from public.pharmacy_inventory
      where pharmacy_id=p_pharmacy_id and product_id=product_id
      for update;
    if available_qty is null or available_qty <= 0 or unit_price is null then raise exception 'A requested product is not currently orderable'; end if;
    select coalesce(sum(i.quantity),0) into reserved_qty
      from public.delivery_order_items i
      join public.delivery_orders o on o.id=i.order_id
      where i.product_id=product_id and o.pharmacy_id=p_pharmacy_id and o.status='ACCEPTED';
    reserved_qty := reserved_qty + coalesce((
      select sum(r.quantity) from public.reservations r
      where r.pharmacy_id=p_pharmacy_id and r.product_id=product_id and r.status='CONFIRMED'
    ), 0);
    if available_qty - reserved_qty < requested_qty then raise exception 'A requested product has insufficient available stock'; end if;
    insert into public.delivery_order_items(order_id, product_id, quantity, unit_price)
      values(order_id, product_id, requested_qty, unit_price);
    subtotal := subtotal + (requested_qty * unit_price);
  end loop;

  update public.delivery_orders set subtotal=subtotal, total=subtotal+delivery_fee, updated_at=now() where id=order_id;
  insert into public.delivery_order_events(order_id,event_type,actor_user_id) values(order_id,'REQUESTED',auth.uid());
  return (select to_jsonb(o) from public.delivery_orders o where o.id=order_id);
end;
$$;

create or replace function public.accept_delivery_order(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  order_row public.delivery_orders%rowtype;
  item record;
  available_qty integer;
  reserved_qty integer;
begin
  select * into order_row from public.delivery_orders where id=p_order_id for update;
  if not found then raise exception 'Delivery order not found'; end if;
  if not (public.is_admin() or public.is_pharmacy_member(order_row.pharmacy_id)) then raise exception 'Not authorized for this pharmacy'; end if;
  if order_row.status <> 'REQUESTED' then raise exception 'This delivery order is no longer pending'; end if;
  for item in select * from public.delivery_order_items where order_id=p_order_id
  loop
    select quantity into available_qty from public.pharmacy_inventory where pharmacy_id=order_row.pharmacy_id and product_id=item.product_id for update;
    select coalesce(sum(i.quantity),0) into reserved_qty
      from public.delivery_order_items i join public.delivery_orders o on o.id=i.order_id
      where i.product_id=item.product_id and o.pharmacy_id=order_row.pharmacy_id and o.status='ACCEPTED';
    reserved_qty := reserved_qty + coalesce((
      select sum(r.quantity) from public.reservations r
      where r.pharmacy_id=order_row.pharmacy_id and r.product_id=item.product_id and r.status='CONFIRMED'
    ), 0);
    if available_qty is null or available_qty-reserved_qty < item.quantity then raise exception 'Stock changed; this order cannot be accepted'; end if;
    insert into public.reservations(customer_id,pharmacy_id,product_id,quantity,status,request_notes,confirmed_at,expires_at)
      values(order_row.customer_id,order_row.pharmacy_id,item.product_id,item.quantity,'CONFIRMED','Delivery order '||p_order_id,now(),now()+interval '2 hours');
  end loop;
  update public.delivery_orders set status='ACCEPTED',accepted_at=now(),expires_at=now()+interval '2 hours',updated_at=now() where id=p_order_id;
  insert into public.delivery_order_events(order_id,event_type,actor_user_id) values(p_order_id,'ACCEPTED',auth.uid());
  return (select to_jsonb(o) from public.delivery_orders o where o.id=p_order_id);
end;
$$;

create or replace function public.reject_delivery_order(p_order_id uuid, p_note text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare order_row public.delivery_orders%rowtype;
begin
  select * into order_row from public.delivery_orders where id=p_order_id for update;
  if not found then raise exception 'Delivery order not found'; end if;
  if not (public.is_admin() or public.is_pharmacy_member(order_row.pharmacy_id)) then raise exception 'Not authorized for this pharmacy'; end if;
  if order_row.status <> 'REQUESTED' then raise exception 'This delivery order is no longer pending'; end if;
  update public.delivery_orders set status='REJECTED',notes=coalesce(notes||E'\n','')||nullif(trim(p_note),''),updated_at=now() where id=p_order_id;
  insert into public.delivery_order_events(order_id,event_type,note,actor_user_id) values(p_order_id,'REJECTED',p_note,auth.uid());
  return (select to_jsonb(o) from public.delivery_orders o where o.id=p_order_id);
end;
$$;

create or replace function public.cancel_delivery_order(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare order_row public.delivery_orders%rowtype;
begin
  select * into order_row from public.delivery_orders where id=p_order_id for update;
  if not found then raise exception 'Delivery order not found'; end if;
  if (auth.uid() is null or order_row.customer_id <> auth.uid()) and not (public.is_admin() or public.is_pharmacy_member(order_row.pharmacy_id)) then raise exception 'Not authorized for this order'; end if;
  if order_row.status not in ('REQUESTED','ACCEPTED') then raise exception 'This delivery order cannot be cancelled'; end if;
  update public.delivery_orders set status='CANCELLED',cancelled_at=now(),updated_at=now() where id=p_order_id;
  update public.reservations set status='CANCELLED',cancelled_at=now(),updated_at=now() where customer_id=order_row.customer_id and pharmacy_id=order_row.pharmacy_id and request_notes='Delivery order '||p_order_id and status='CONFIRMED';
  insert into public.delivery_order_events(order_id,event_type,actor_user_id) values(p_order_id,'CANCELLED',auth.uid());
  return (select to_jsonb(o) from public.delivery_orders o where o.id=p_order_id);
end;
$$;

create or replace function public.submit_delivery_payment_receipt(p_order_id uuid, p_note text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare order_row public.delivery_orders%rowtype;
begin
  select * into order_row from public.delivery_orders where id=p_order_id for update;
  if not found or auth.uid() is null or order_row.customer_id <> auth.uid() then raise exception 'Delivery order not found'; end if;
  if order_row.status not in ('REQUESTED','ACCEPTED') then raise exception 'This order is not awaiting payment'; end if;
  update public.delivery_orders set payment_status='RECEIPT_SUBMITTED',receipt_note=trim(p_note),updated_at=now() where id=p_order_id;
  insert into public.delivery_order_events(order_id,event_type,note,actor_user_id) values(p_order_id,'PAYMENT_RECEIPT_SUBMITTED',p_note,auth.uid());
  return (select to_jsonb(o) from public.delivery_orders o where o.id=p_order_id);
end;
$$;

create or replace function public.confirm_delivery_payment(p_order_id uuid, p_reference text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare order_row public.delivery_orders%rowtype;
begin
  select * into order_row from public.delivery_orders where id=p_order_id for update;
  if not found then raise exception 'Delivery order not found'; end if;
  if not (public.is_admin() or public.is_pharmacy_owner(order_row.pharmacy_id)) then raise exception 'Not authorized for this pharmacy'; end if;
  if order_row.payment_status <> 'RECEIPT_SUBMITTED' then raise exception 'A receipt must be submitted before confirmation'; end if;
  update public.delivery_orders set payment_status='CONFIRMED',payment_reference=trim(p_reference),updated_at=now() where id=p_order_id;
  insert into public.delivery_order_events(order_id,event_type,note,actor_user_id) values(p_order_id,'PAYMENT_CONFIRMED',p_reference,auth.uid());
  return (select to_jsonb(o) from public.delivery_orders o where o.id=p_order_id);
end;
$$;

create or replace function public.deliver_delivery_order(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare order_row public.delivery_orders%rowtype;
  item record;
begin
  select * into order_row from public.delivery_orders where id=p_order_id for update;
  if not found then raise exception 'Delivery order not found'; end if;
  if not (public.is_admin() or public.is_pharmacy_owner(order_row.pharmacy_id)) then raise exception 'Not authorized for this pharmacy'; end if;
  if order_row.status <> 'ACCEPTED' or order_row.payment_status <> 'CONFIRMED' then raise exception 'Confirm the bank transfer before delivery'; end if;
  update public.delivery_orders set status='DELIVERED',delivered_at=now(),updated_at=now() where id=p_order_id;
  update public.reservations set status='FULFILLED',fulfilled_at=now(),updated_at=now() where customer_id=order_row.customer_id and pharmacy_id=order_row.pharmacy_id and request_notes='Delivery order '||p_order_id and status='CONFIRMED';
  for item in select product_id, quantity from public.delivery_order_items where order_id = p_order_id
  loop
    update public.pharmacy_inventory
    set quantity = greatest(coalesce(quantity, 0) - item.quantity, 0),
        last_updated_at = now(), last_verified_at = now(), updated_by = auth.uid()
    where pharmacy_id = order_row.pharmacy_id and product_id = item.product_id;
  end loop;
  insert into public.delivery_order_events(order_id,event_type,actor_user_id) values(p_order_id,'DELIVERED',auth.uid());
  return (select to_jsonb(o) from public.delivery_orders o where o.id=p_order_id);
end;
$$;

revoke all on function public.create_delivery_order(uuid,text,text,text,jsonb) from public;
revoke all on function public.accept_delivery_order(uuid) from public;
revoke all on function public.reject_delivery_order(uuid,text) from public;
revoke all on function public.cancel_delivery_order(uuid) from public;
revoke all on function public.submit_delivery_payment_receipt(uuid,text) from public;
revoke all on function public.confirm_delivery_payment(uuid,text) from public;
revoke all on function public.deliver_delivery_order(uuid) from public;
grant execute on function public.create_delivery_order(uuid,text,text,text,jsonb) to authenticated;
grant execute on function public.accept_delivery_order(uuid) to authenticated;
grant execute on function public.reject_delivery_order(uuid,text) to authenticated;
grant execute on function public.cancel_delivery_order(uuid) to authenticated;
grant execute on function public.submit_delivery_payment_receipt(uuid,text) to authenticated;
grant execute on function public.confirm_delivery_payment(uuid,text) to authenticated;
grant execute on function public.deliver_delivery_order(uuid) to authenticated;
