-- Tighten the alias insert policy: only admins (global aliases) or the
-- pharmacy's own members may add an alias — never any authenticated user.
drop policy if exists "product_aliases_insert_authenticated" on public.product_aliases;
create policy "product_aliases_insert_admin_or_member" on public.product_aliases
  for insert with check (
    auth.uid() is not null
    and (public.is_admin() or public.is_pharmacy_member(pharmacy_id))
  );
