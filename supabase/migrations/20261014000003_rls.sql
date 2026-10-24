-- MedFind — Row Level Security
-- Every user-data table has RLS enabled. Roles are enforced both here and in
-- the application layer (defense in depth). Anon users (guests) can read
-- public catalog data; private data is scoped per-user.

-- ---------------------------------------------------------------------------
-- Security-definer helpers (bypass RLS internally to avoid recursion).
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_pharmacy_member(target_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pharmacy_members
    where pharmacy_id = target_pharmacy_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_pharmacy_member(uuid) from public;
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_pharmacy_member(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "profiles_insert_own_customer" on public.profiles
  for insert with check (auth.uid() = id and role = 'customer');

create policy "profiles_update_own_or_admin" on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

create policy "profiles_delete_own_or_admin" on public.profiles
  for delete using (auth.uid() = id or public.is_admin());

-- ---------------------------------------------------------------------------
-- pharmacies (public catalog; writes restricted)
-- ---------------------------------------------------------------------------

alter table public.pharmacies enable row level security;

create policy "pharmacies_select_public" on public.pharmacies
  for select using (true);

create policy "pharmacies_insert_admin" on public.pharmacies
  for insert with check (public.is_admin());

create policy "pharmacies_update_admin_or_member" on public.pharmacies
  for update
  using (public.is_admin() or public.is_pharmacy_member(id))
  with check (public.is_admin() or public.is_pharmacy_member(id));

create policy "pharmacies_delete_admin" on public.pharmacies
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- pharmacy_members
-- ---------------------------------------------------------------------------

alter table public.pharmacy_members enable row level security;

create policy "members_select_own_or_admin" on public.pharmacy_members
  for select using (user_id = auth.uid() or public.is_admin());

create policy "members_insert_admin" on public.pharmacy_members
  for insert with check (public.is_admin());

create policy "members_update_admin" on public.pharmacy_members
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "members_delete_admin" on public.pharmacy_members
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- products (public catalog; admin-managed)
-- ---------------------------------------------------------------------------

alter table public.products enable row level security;

create policy "products_select_public" on public.products
  for select using (true);

create policy "products_insert_admin" on public.products
  for insert with check (public.is_admin());

create policy "products_update_admin" on public.products
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "products_delete_admin" on public.products
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- product_active_ingredients
-- ---------------------------------------------------------------------------

alter table public.product_active_ingredients enable row level security;

create policy "ingredients_select_public" on public.product_active_ingredients
  for select using (true);

create policy "ingredients_insert_admin" on public.product_active_ingredients
  for insert with check (public.is_admin());

create policy "ingredients_update_admin" on public.product_active_ingredients
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "ingredients_delete_admin" on public.product_active_ingredients
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- pharmacy_inventory
-- ---------------------------------------------------------------------------

alter table public.pharmacy_inventory enable row level security;

create policy "inventory_select_public" on public.pharmacy_inventory
  for select using (true);

create policy "inventory_insert_admin_or_member" on public.pharmacy_inventory
  for insert with check (public.is_admin() or public.is_pharmacy_member(pharmacy_id));

create policy "inventory_update_admin_or_member" on public.pharmacy_inventory
  for update
  using (public.is_admin() or public.is_pharmacy_member(pharmacy_id))
  with check (public.is_admin() or public.is_pharmacy_member(pharmacy_id));

create policy "inventory_delete_admin_or_member" on public.pharmacy_inventory
  for delete using (public.is_admin() or public.is_pharmacy_member(pharmacy_id));

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------

alter table public.reservations enable row level security;

create policy "reservations_select_owner_member_admin" on public.reservations
  for select using (
    customer_id = auth.uid()
    or public.is_pharmacy_member(pharmacy_id)
    or public.is_admin()
  );

create policy "reservations_insert_owner_requested" on public.reservations
  for insert with check (customer_id = auth.uid() and status = 'REQUESTED');

create policy "reservations_update_owner_member_admin" on public.reservations
  for update
  using (
    customer_id = auth.uid()
    or public.is_pharmacy_member(pharmacy_id)
    or public.is_admin()
  )
  with check (
    customer_id = auth.uid()
    or public.is_pharmacy_member(pharmacy_id)
    or public.is_admin()
  );

-- Reservations are never hard-deleted; terminal states are preserved for the
-- audit trail, so there is intentionally no DELETE policy.

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------

alter table public.favorites enable row level security;

create policy "favorites_select_own" on public.favorites
  for select using (user_id = auth.uid());

create policy "favorites_insert_own" on public.favorites
  for insert with check (user_id = auth.uid());

create policy "favorites_delete_own" on public.favorites
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- saved_searches
-- ---------------------------------------------------------------------------

alter table public.saved_searches enable row level security;

create policy "saved_searches_select_own" on public.saved_searches
  for select using (user_id = auth.uid());

create policy "saved_searches_insert_own" on public.saved_searches
  for insert with check (user_id = auth.uid());

create policy "saved_searches_update_own" on public.saved_searches
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "saved_searches_delete_own" on public.saved_searches
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Insert is service-role only (server-side notification creation).

-- ---------------------------------------------------------------------------
-- stock_reports
-- ---------------------------------------------------------------------------

alter table public.stock_reports enable row level security;

create policy "stock_reports_select_own_or_admin" on public.stock_reports
  for select using (reporter_user_id = auth.uid() or public.is_admin());

create policy "stock_reports_insert_authenticated" on public.stock_reports
  for insert with check (reporter_user_id = auth.uid());

create policy "stock_reports_update_admin" on public.stock_reports
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "stock_reports_delete_admin" on public.stock_reports
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_admin" on public.audit_logs
  for select using (public.is_admin());

create policy "audit_logs_insert_admin" on public.audit_logs
  for insert with check (public.is_admin());
