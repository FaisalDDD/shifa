-- Multi-token search: split the query into whitespace-separated tokens and
-- require every token to match somewhere in the product (name, brand, strength,
-- dosage form, description, categories, active ingredient). Fixes queries like
-- "paracetamol 500 mg" or "cd torside 10 mg" after names were split into
-- name + strength columns. Single-word typo tolerance via pg_trgm is retained.
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
    select
      lower(btrim(regexp_replace(search_term, '\s+', ' ', 'g'))) as term,
      regexp_split_to_array(lower(btrim(regexp_replace(search_term, '\s+', ' ', 'g'))), '\s+') as tokens
  ),
  base as (
    select
      p.id, p.canonical_name, p.brand_name, p.strength, p.dosage_form,
      p.barcode, p.product_identifier, p.prescription_classification, p.is_demo,
      p.description, p.categories,
      coalesce(array_agg(ai.active_ingredient) filter (where ai.active_ingredient is not null), '{}') as active_ingredients
    from public.products p
    left join public.product_active_ingredients ai on ai.product_id = p.id
    group by p.id
  ),
  hay as (
    select
      b.*,
      lower(coalesce(b.canonical_name, '')) || ' ' ||
      lower(coalesce(b.brand_name, '')) || ' ' ||
      lower(coalesce(b.strength, '')) || ' ' ||
      lower(coalesce(b.dosage_form, '')) || ' ' ||
      lower(coalesce(b.description, '')) || ' ' ||
      lower(coalesce(array_to_string(b.categories, ' '), '')) || ' ' ||
      lower(coalesce(array_to_string(b.active_ingredients, ' '), '')) as haystack
    from base b
  ),
  candidates as (
    select
      h.id, h.canonical_name, h.brand_name, h.strength, h.dosage_form,
      h.barcode, h.product_identifier, h.prescription_classification, h.is_demo,
      h.active_ingredients,
      case
        when lower(h.canonical_name) = q.term then 100.0
        when lower(h.brand_name) = q.term then 95.0
        when h.barcode = search_term then 90.0
        when lower(h.product_identifier) = q.term then 90.0
        when lower(coalesce(h.strength, '')) = q.term then 88.0
        when exists (select 1 from unnest(h.categories) c where lower(c) = q.term) then 88.0
        when lower(h.canonical_name) like q.term || '%' then 85.0
        when lower(h.brand_name) like q.term || '%' then 80.0
        when exists (select 1 from unnest(h.categories) c where lower(c) like '%' || q.term || '%') then 75.0
        else greatest(
          similarity(lower(h.canonical_name), q.term),
          similarity(lower(h.brand_name), q.term),
          similarity(lower(coalesce(h.description, '')), q.term)
        ) * 60.0
      end as base_score
    from hay h
    cross join q
    where q.term <> ''
      and (
        (select bool_and(h.haystack like '%' || t || '%') from unnest(q.tokens) t)
        or lower(h.product_identifier) = q.term
        or h.barcode = search_term
        or similarity(lower(h.canonical_name), q.term) > 0.3
        or similarity(lower(h.brand_name), q.term) > 0.3
      )
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
