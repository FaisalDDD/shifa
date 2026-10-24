-- Hide operational inventory quantities from anonymous and customer sessions.
-- Customers use pharmacy_inventory_public or the public availability RPC.

drop policy if exists "inventory_select_public" on public.pharmacy_inventory;
create policy "inventory_select_member_or_admin" on public.pharmacy_inventory
  for select using (public.is_admin() or public.is_pharmacy_member(pharmacy_id));
