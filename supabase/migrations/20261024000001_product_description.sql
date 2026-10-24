-- Add a free-text description column for catalog products (imported price lists
-- carry a human-readable description/ingredient summary separate from brand/strength).
alter table public.products add column description text;
