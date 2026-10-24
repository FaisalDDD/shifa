-- Shifa — self-serve pharmacy registration: make the authenticated creator
-- the OWNER of a newly inserted (pending) pharmacy automatically.
--
-- The web app already creates this owner row via the service role in
-- register.ts. This trigger makes the same happen for clients that talk to
-- PostgREST directly (the native Android app), so both surfaces get a
-- consistent result without duplicated business logic.
--
-- It is a no-op for service-role inserts (auth.uid() is null there), so admin
-- and server-side creation flows are unaffected.

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
  end if;
  return new;
end;
$$;

create trigger pharmacies_assign_owner
  after insert on public.pharmacies
  for each row execute function public.assign_pharmacy_owner();
