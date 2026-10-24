-- Correct ambiguous PL/pgSQL identifiers in delivery-order creation.
create or replace function public.create_delivery_order(
  p_pharmacy_id uuid,
  p_delivery_address text,
  p_contact_phone text,
  p_notes text,
  p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order_id uuid := gen_random_uuid();
  item jsonb;
  v_product_id uuid;
  v_requested_qty integer;
  v_available_qty integer;
  v_reserved_qty integer;
  v_unit_price numeric;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_is_enabled boolean;
begin
  if auth.uid() is null then raise exception 'Sign in before placing a delivery order'; end if;
  if length(trim(coalesce(p_delivery_address, ''))) < 5 or length(trim(coalesce(p_contact_phone, ''))) < 5 then
    raise exception 'Delivery address and contact phone are required';
  end if;
  select s.enabled, s.delivery_fee into v_is_enabled, v_delivery_fee
    from public.pharmacy_delivery_settings s
    where s.pharmacy_id = p_pharmacy_id;
  if not coalesce(v_is_enabled, false) then raise exception 'This pharmacy does not accept delivery orders'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Add at least one product'; end if;

  insert into public.delivery_orders(customer_id, pharmacy_id, delivery_address, contact_phone, notes, subtotal, delivery_fee, total)
    values (auth.uid(), p_pharmacy_id, trim(p_delivery_address), trim(p_contact_phone), nullif(trim(p_notes), ''), 0, v_delivery_fee, v_delivery_fee);

  for item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (item->>'product_id')::uuid;
    v_requested_qty := (item->>'quantity')::integer;
    if v_requested_qty is null or v_requested_qty <= 0 then raise exception 'Each delivery quantity must be positive'; end if;
    select inv.quantity, inv.price into v_available_qty, v_unit_price
      from public.pharmacy_inventory inv
      where inv.pharmacy_id=p_pharmacy_id and inv.product_id=v_product_id
      for update;
    if v_available_qty is null or v_available_qty <= 0 or v_unit_price is null then raise exception 'A requested product is not currently orderable'; end if;
    select coalesce(sum(i.quantity),0) into v_reserved_qty
      from public.delivery_order_items i
      join public.delivery_orders o on o.id=i.order_id
      where i.product_id=v_product_id and o.pharmacy_id=p_pharmacy_id and o.status='ACCEPTED';
    if v_available_qty - v_reserved_qty < v_requested_qty then raise exception 'A requested product has insufficient available stock'; end if;
    insert into public.delivery_order_items(order_id, product_id, quantity, unit_price)
      values(v_order_id, v_product_id, v_requested_qty, v_unit_price);
    v_subtotal := v_subtotal + (v_requested_qty * v_unit_price);
  end loop;

  update public.delivery_orders o set subtotal=v_subtotal, total=v_subtotal+v_delivery_fee, updated_at=now() where o.id=v_order_id;
  insert into public.delivery_order_events(order_id,event_type,actor_user_id) values(v_order_id,'REQUESTED',auth.uid());
  return (select to_jsonb(o) from public.delivery_orders o where o.id=v_order_id);
end;
$$;
