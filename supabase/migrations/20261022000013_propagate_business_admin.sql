-- Propagate business administrators to branches registered after their setup.
create or replace function public.assign_pharmacy_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into public.pharmacy_members (pharmacy_id, user_id, membership_role)
    values (new.id, auth.uid(), 'owner')
    on conflict (pharmacy_id, user_id) do nothing;

    insert into public.pharmacy_business_members (business_id, user_id, membership_role)
    values (new.business_id, auth.uid(), 'owner')
    on conflict (business_id, user_id) do update set membership_role = 'owner';
  end if;

  insert into public.pharmacy_members (pharmacy_id, user_id, membership_role)
  select new.id, business_member.user_id, 'owner'
  from public.pharmacy_business_members business_member
  where business_member.business_id = new.business_id
    and business_member.membership_role = 'admin'
  on conflict (pharmacy_id, user_id) do nothing;

  return new;
end;
$$;
