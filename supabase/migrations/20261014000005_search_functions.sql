-- MedFind — search and geo query functions (called via RPC from the service layer).

-- Candidate product search: case-insensitive + typo-tolerant (pg_trgm),
-- covering name, brand, active ingredient, barcode and product identifier.
-- Final explainable ranking happens in the application layer.
create or replace function public.search_products(
  search_term text,
  include_demo boolean default false,
  result_limit int default 100
)
returns table (
  id uuid,
  canonical_name text,
  brand_name text,
  strength text,
  dosage_form text,
  barcode text,
  product_identifier text,
  prescription_classification public.prescription_classification,
  is_demo boolean,
  active_ingredients text[],
  base_score double precision
)
language sql
stable
as $$
  with q as (
    select lower(btrim(regexp_replace(search_term, '\s+', ' ', 'g'))) as term
  ),
  candidates as (
    select distinct
      p.id, p.canonical_name, p.brand_name, p.strength, p.dosage_form,
      p.barcode, p.product_identifier, p.prescription_classification, p.is_demo,
      coalesce(array_agg(ai.active_ingredient) filter (where ai.active_ingredient is not null), '{}') as active_ingredients,
      case
        when lower(p.canonical_name) = q.term then 100.0
        when lower(p.brand_name) = q.term then 95.0
        when p.barcode = search_term then 90.0
        when lower(p.product_identifier) = q.term then 90.0
        when lower(p.canonical_name) like q.term || '%' then 85.0
        when lower(p.brand_name) like q.term || '%' then 80.0
        else greatest(similarity(lower(p.canonical_name), q.term), similarity(lower(p.brand_name), q.term)) * 60.0
      end as base_score
    from public.products p
    cross join q
    left join public.product_active_ingredients ai on ai.product_id = p.id
    where q.term <> ''
      and (
        lower(p.canonical_name) like '%' || q.term || '%'
        or lower(p.brand_name) like '%' || q.term || '%'
        or lower(p.product_identifier) = q.term
        or p.barcode = search_term
        or similarity(lower(p.canonical_name), q.term) > 0.3
        or similarity(lower(p.brand_name), q.term) > 0.3
        or lower(ai.active_ingredient) like '%' || q.term || '%'
      )
    group by p.id, q.term
  )
  select * from candidates
  where include_demo or not is_demo
  order by base_score desc, canonical_name
  limit result_limit;
$$;

-- Nearby pharmacies with distance in meters (consistent unit across the app).
create or replace function public.nearby_pharmacies(
  search_lat double precision,
  search_lng double precision,
  radius_m double precision,
  include_demo boolean default false,
  result_limit int default 50
)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  address text,
  city text,
  postal_code text,
  country_code text,
  latitude double precision,
  longitude double precision,
  phone text,
  website text,
  verification_status public.verification_status,
  is_active boolean,
  is_demo boolean,
  opening_hours jsonb,
  services text[],
  distance_m double precision
)
language sql
stable
as $$
  with origin as (
    select st_setsrid(st_makepoint(search_lng, search_lat), 4326)::geography as point
  )
  select
    p.id, p.name, p.slug, p.description, p.address, p.city, p.postal_code,
    p.country_code, p.latitude, p.longitude, p.phone, p.website,
    p.verification_status, p.is_active, p.is_demo, p.opening_hours, p.services,
    st_distance(p.location, o.point) as distance_m
  from public.pharmacies p
  cross join origin o
  where p.location is not null
    and p.is_active
    and st_dwithin(p.location, o.point, radius_m)
    and (include_demo or not p.is_demo)
  order by distance_m asc
  limit result_limit;
$$;
