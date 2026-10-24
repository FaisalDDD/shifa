-- Tighten branch registration after introducing business_id.
-- A caller may create a new pending business only when business_id is null;
-- adding a branch to an existing business requires business-owner access.

drop policy if exists "pharmacies_insert_authenticated_pending" on public.pharmacies;
create policy "pharmacies_insert_new_business_pending" on public.pharmacies
  for insert
  with check (
    auth.uid() is not null
    and business_id is null
    and verification_status = 'pending'
    and is_demo = false
  );

create policy "pharmacies_insert_business_branch_pending" on public.pharmacies
  for insert
  with check (
    public.is_admin()
    or (
      business_id is not null
      and public.is_business_owner(business_id)
      and verification_status = 'pending'
      and is_demo = false
    )
  );
