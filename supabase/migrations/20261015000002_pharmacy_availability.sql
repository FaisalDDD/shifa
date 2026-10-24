-- Pharmacy availability toggle: a pharmacy can mark itself temporarily
-- "not available" (e.g. closed for the day) without being de-listed.
alter table public.pharmacies
  add column is_available boolean not null default true;

create index pharmacies_available_idx on public.pharmacies (is_available);
