-- Owner/staff-scoped threshold update for offline Pro synchronization.
create or replace function public.set_pharmacy_inventory_threshold(
  p_pharmacy_id uuid,
  p_product_id uuid,
  p_threshold integer
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_pharmacy_member(p_pharmacy_id)) then
    raise exception 'Not authorized for this pharmacy';
  end if;
  if p_threshold < 0 or p_threshold > 1000000 then
    raise exception 'Threshold is outside the allowed range';
  end if;
  insert into public.pharmacy_inventory(
    pharmacy_id, product_id, quantity, low_stock_threshold, availability_status,
    source, last_updated_at, last_verified_at, updated_by
  ) values (
    p_pharmacy_id, p_product_id, null, p_threshold, 'UNKNOWN',
    'PHARMACY_MANUAL', now(), null, auth.uid()
  )
  on conflict (pharmacy_id, product_id) do update set
    low_stock_threshold = excluded.low_stock_threshold,
    last_updated_at = now(),
    updated_by = auth.uid();
  return jsonb_build_object('updated', true, 'threshold', p_threshold);
end;
$$;

revoke all on function public.set_pharmacy_inventory_threshold(uuid, uuid, integer) from public;
grant execute on function public.set_pharmacy_inventory_threshold(uuid, uuid, integer) to authenticated;
