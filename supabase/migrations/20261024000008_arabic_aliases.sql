-- Arabic search normalization + per-pharmacy product aliases.
--
-- normalize_arabic folds the variant spellings a Sudanese customer will type
-- (أ/إ/آ/ٱ -> ا, ة -> ه, ى/ئ -> ي, ؤ -> و) and strips tashkeel diacritics and
-- tatweel, so "اسبرين" / "أسبيرين" / "إسبرين" all match. It is a superset of
-- lower(), so it is safe to use for English text too.

create or replace function public.normalize_arabic(input text) returns text
language sql immutable strict as $$
  select translate(
    regexp_replace(lower(input), '[ًٌٍَُِّْٰـ]', '', 'g'),
    'أإآٱىيئةؤ',
    'اااايييهو'
  );
$$;

-- Per-pharmacy (or global) alternative names for a product. A pharmacy adds a
-- local name ("أدول" for paracetamol) so customers searching that name still
-- find the product; pharmacy_id NULL means a platform-wide alias.
create table if not exists public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  pharmacy_id uuid references public.pharmacies(id) on delete cascade,
  alias text not null,
  lang text not null default 'ar',
  created_at timestamptz not null default now(),
  unique (product_id, pharmacy_id, alias)
);
create index if not exists idx_product_aliases_product on public.product_aliases(product_id);
create index if not exists idx_product_aliases_pharmacy on public.product_aliases(pharmacy_id);

alter table public.product_aliases enable row level security;
create policy "product_aliases_select_all" on public.product_aliases
  for select using (true);
create policy "product_aliases_insert_authenticated" on public.product_aliases
  for insert with check (auth.uid() is not null);

-- search_products: Arabic-normalized token matching + alias matching.
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
      normalize_arabic(btrim(regexp_replace(search_term, '\s+', ' ', 'g'))) as term,
      regexp_split_to_array(normalize_arabic(btrim(regexp_replace(search_term, '\s+', ' ', 'g'))), '\s+') as tokens
  ),
  base as (
    select
      p.id, p.canonical_name, p.brand_name, p.strength, p.dosage_form,
      p.barcode, p.product_identifier, p.prescription_classification, p.is_demo,
      p.description, p.categories,
      coalesce((select array_agg(ai.active_ingredient) from public.product_active_ingredients ai
        where ai.product_id = p.id and ai.active_ingredient is not null), '{}') as active_ingredients,
      coalesce((select array_agg(a.alias) from public.product_aliases a
        where a.product_id = p.id), '{}') as aliases
    from public.products p
    where include_demo or not p.is_demo
  ),
  hay as (
    select
      b.*,
      normalize_arabic(coalesce(b.canonical_name, '')) || ' ' ||
      normalize_arabic(coalesce(b.brand_name, '')) || ' ' ||
      normalize_arabic(coalesce(b.strength, '')) || ' ' ||
      normalize_arabic(coalesce(b.dosage_form, '')) || ' ' ||
      normalize_arabic(coalesce(b.description, '')) || ' ' ||
      normalize_arabic(coalesce(array_to_string(b.categories, ' '), '')) || ' ' ||
      normalize_arabic(coalesce(array_to_string(b.active_ingredients, ' '), '')) || ' ' ||
      normalize_arabic(coalesce(array_to_string(b.aliases, ' '), '')) as haystack
    from base b
  ),
  candidates as (
    select
      h.id, h.canonical_name, h.brand_name, h.strength, h.dosage_form,
      h.barcode, h.product_identifier, h.prescription_classification, h.is_demo,
      h.active_ingredients,
      case
        when normalize_arabic(h.canonical_name) = q.term then 100.0
        when normalize_arabic(h.brand_name) = q.term then 95.0
        when h.barcode = search_term then 90.0
        when normalize_arabic(h.product_identifier) = q.term then 90.0
        when normalize_arabic(coalesce(h.strength, '')) = q.term then 88.0
        when exists (select 1 from unnest(h.categories) c where normalize_arabic(c) = q.term) then 88.0
        when exists (select 1 from unnest(h.aliases) al where normalize_arabic(al) = q.term) then 86.0
        when normalize_arabic(h.canonical_name) like q.term || '%' then 85.0
        when normalize_arabic(h.brand_name) like q.term || '%' then 80.0
        when exists (select 1 from unnest(h.categories) c where normalize_arabic(c) like '%' || q.term || '%') then 75.0
        else greatest(
          similarity(normalize_arabic(h.canonical_name), q.term),
          similarity(normalize_arabic(h.brand_name), q.term),
          similarity(normalize_arabic(coalesce(h.description, '')), q.term)
        ) * 60.0
      end as base_score
    from hay h
    cross join q
    where q.term <> ''
      and (
        (select bool_and(h.haystack like '%' || t || '%') from unnest(q.tokens) t)
        or normalize_arabic(h.product_identifier) = q.term
        or h.barcode = search_term
        or similarity(normalize_arabic(h.canonical_name), q.term) > 0.3
        or similarity(normalize_arabic(h.brand_name), q.term) > 0.3
      )
  )
  select
    id, canonical_name, brand_name, strength, dosage_form,
    barcode, product_identifier, prescription_classification, is_demo,
    active_ingredients, base_score
  from candidates
  order by base_score desc, canonical_name
  limit result_limit;
$$;
