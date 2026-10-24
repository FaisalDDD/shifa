-- MedFind — triggers
-- updated_at maintenance, profile creation on signup, pharmacy location,
-- role protection, pharmacy sensitive-field protection, reservation state machine.

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger pharmacies_set_updated_at before update on public.pharmacies
  for each row execute function public.set_updated_at();

create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create trigger saved_searches_set_updated_at before update on public.saved_searches
  for each row execute function public.set_updated_at();

create trigger reservations_set_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile creation on signup (role always 'customer' — never trust client).
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email,
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Pharmacy location (geography column derived from lat/lng)
-- ---------------------------------------------------------------------------

create or replace function public.set_pharmacy_location()
returns trigger
language plpgsql
as $$
begin
  new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  return new;
end;
$$;

create trigger pharmacy_set_location
  before insert or update of latitude, longitude on public.pharmacies
  for each row execute function public.set_pharmacy_location();

-- ---------------------------------------------------------------------------
-- Role protection: users cannot self-elevate. Only an admin (or the trusted
-- service role, where auth.uid() is null) may change roles.
-- ---------------------------------------------------------------------------

create or replace function public.protect_role_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.role <> 'customer'
       and auth.uid() is not null
       and not public.is_admin() then
      raise exception 'Only administrators can assign elevated roles';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Only administrators can change roles';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before insert or update on public.profiles
  for each row execute function public.protect_role_change();

-- ---------------------------------------------------------------------------
-- Pharmacy sensitive-field protection for non-admin writers (pharmacy staff).
-- ---------------------------------------------------------------------------

create or replace function public.protect_pharmacy_sensitive_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new; -- service role (trusted server)
  end if;

  if not public.is_admin() then
    if new.is_active is distinct from old.is_active then
      raise exception 'Only administrators can change active status';
    end if;

    if new.verification_status is distinct from old.verification_status
       and new.verification_status in ('verified', 'rejected', 'suspended') then
      raise exception 'Only administrators can change verification status';
    end if;

    -- Identity changes require re-verification.
    if new.name is distinct from old.name
       or new.address is distinct from old.address
       or new.latitude is distinct from old.latitude
       or new.longitude is distinct from old.longitude then
      new.verification_status := 'pending';
    end if;
  end if;

  return new;
end;
$$;

create trigger pharmacies_protect_sensitive
  before update on public.pharmacies
  for each row execute function public.protect_pharmacy_sensitive_fields();

-- ---------------------------------------------------------------------------
-- Reservation state machine (database-level guard).
-- The service layer is authoritative for actor permissions; this trigger
-- additionally prevents illegal transitions and blocks non-pharmacy confirm.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_reservation_transitions()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    case old.status
      when 'REQUESTED' then
        if new.status not in ('CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED') then
          raise exception 'Invalid transition from REQUESTED to %', new.status;
        end if;
      when 'CONFIRMED' then
        if new.status not in ('FULFILLED', 'CANCELLED') then
          raise exception 'Invalid transition from CONFIRMED to %', new.status;
        end if;
      else
        -- REJECTED / FULFILLED / CANCELLED / EXPIRED are terminal.
        raise exception 'Cannot transition from terminal state %', old.status;
    end case;

    -- Only an admin, a member of the target pharmacy, or the trusted service
    -- role may confirm / reject / fulfill.
    if new.status in ('CONFIRMED', 'REJECTED', 'FULFILLED')
       and auth.uid() is not null
       and not (public.is_admin() or public.is_pharmacy_member(new.pharmacy_id)) then
      raise exception 'Only authorized pharmacy staff can % a reservation', new.status;
    end if;
  end if;

  return new;
end;
$$;

create trigger reservations_enforce_transitions
  before update on public.reservations
  for each row execute function public.enforce_reservation_transitions();
