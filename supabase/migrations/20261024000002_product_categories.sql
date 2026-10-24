-- Therapeutic categories for catalog products, stored as an array of labels in
-- both English and Arabic so searches like "diabetes" or "السكري" match the same
-- products. Classified from the imported price-list descriptions.
alter table public.products add column categories text[] not null default '{}';

create index products_categories_gin_idx on public.products using gin (categories);
