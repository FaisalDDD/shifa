-- Expose the pharmacy-entered pack size on the customer-safe projection.
-- Dropped and recreated because CREATE OR REPLACE VIEW cannot change the
-- column set/order of an existing view.
drop view if exists public.pharmacy_inventory_public;
create view public.pharmacy_inventory_public as
select
  id, pharmacy_id, product_id, availability_status, price, currency,
  size, last_updated_at, last_verified_at, expires_at, created_at
from public.pharmacy_inventory;

grant select on public.pharmacy_inventory_public to anon, authenticated;

comment on view public.pharmacy_inventory_public is
  'Customer-safe availability projection. Exact operational quantities are not exposed.';
