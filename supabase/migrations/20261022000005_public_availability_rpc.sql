-- Safe customer availability RPC for Android and other thin clients.
-- It returns branch/contact information and status, never exact quantity.

create or replace function public.product_availability_public(p_product_id uuid)
returns table (
  id uuid,
  product_id uuid,
  availability_status public.availability_status,
  price numeric,
  currency text,
  last_verified_at timestamptz,
  pharmacy_id uuid,
  pharmacy_name text,
  pharmacy_slug text,
  pharmacy_address text,
  pharmacy_city text,
  pharmacy_phone text,
  pharmacy_latitude double precision,
  pharmacy_longitude double precision,
  pharmacy_verification_status public.verification_status,
  pharmacy_is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.product_id,
    i.availability_status,
    i.price,
    i.currency,
    i.last_verified_at,
    p.id,
    p.name,
    p.slug,
    p.address,
    p.city,
    p.phone,
    p.latitude,
    p.longitude,
    p.verification_status,
    p.is_active
  from public.pharmacy_inventory i
  join public.pharmacies p on p.id = i.pharmacy_id
  where i.product_id = p_product_id
    and p.is_active = true;
$$;

revoke all on function public.product_availability_public(uuid) from public;
grant execute on function public.product_availability_public(uuid) to anon, authenticated;
