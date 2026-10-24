-- Add strength and dosage_form to product search so "500 mg", "500mg",
-- "tabs", "syrup", etc. still match after the name cleanup.
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
      p.description, p.categories,
      coalesce(array_agg(ai.active_ingredient) filter (where ai.active_ingredient is not null), '{}') as active_ingredients,
      case
        when lower(p.canonical_name) = q.term then 100.0
        when lower(p.brand_name) = q.term then 95.0
        when p.barcode = search_term then 90.0
        when lower(p.product_identifier) = q.term then 90.0
        when lower(coalesce(p.strength, '')) = q.term then 88.0
        when exists (select 1 from unnest(p.categories) c where lower(c) = q.term) then 88.0
        when lower(p.canonical_name) like q.term || '%' then 85.0
        when lower(p.brand_name) like q.term || '%' then 80.0
        when exists (select 1 from unnest(p.categories) c where lower(c) like '%' || q.term || '%') then 75.0
        else greatest(
          similarity(lower(p.canonical_name), q.term),
          similarity(lower(p.brand_name), q.term),
          similarity(lower(coalesce(p.description, '')), q.term)
        ) * 60.0
      end as base_score
    from public.products p
    cross join q
    left join public.product_active_ingredients ai on ai.product_id = p.id
    where q.term <> ''
      and (
        lower(p.canonical_name) like '%' || q.term || '%'
        or lower(p.brand_name) like '%' || q.term || '%'
        or lower(coalesce(p.strength, '')) like '%' || q.term || '%'
        or lower(coalesce(p.dosage_form, '')) like '%' || q.term || '%'
        or lower(p.product_identifier) = q.term
        or p.barcode = search_term
        or lower(coalesce(p.description, '')) like '%' || q.term || '%'
        or exists (select 1 from unnest(p.categories) c where lower(c) like '%' || q.term || '%')
        or similarity(lower(p.canonical_name), q.term) > 0.3
        or similarity(lower(p.brand_name), q.term) > 0.3
        or similarity(lower(coalesce(p.description, '')), q.term) > 0.3
        or lower(ai.active_ingredient) like '%' || q.term || '%'
      )
    group by p.id, q.term
  )
  select
    id, canonical_name, brand_name, strength, dosage_form,
    barcode, product_identifier, prescription_classification, is_demo,
    active_ingredients, base_score
  from candidates
  where include_demo or not is_demo
  order by base_score desc, canonical_name
  limit result_limit;
$$;
