-- Shifa — pharmacy product submissions with images.
-- Pharmacies can propose new products (verification_status = 'pending') that an
-- admin verifies into the shared catalog. Each submission carries an image URL
-- for later reference, so the Shifa database is the single source of truth for
-- every product added by any pharmacy.

alter table public.products
  add column if not exists image_url text;

alter table public.products
  add column if not exists verification_status public.verification_status
  not null default 'verified';

alter table public.products
  add column if not exists submitted_by uuid
  references public.profiles (id) on delete set null;

create index if not exists products_verification_idx
  on public.products (verification_status);

-- Existing rows default to 'verified'; only new submissions start 'pending'.

-- Re-scope public visibility: only verified products (or the submitter/admin)
-- are readable. Pending submissions stay hidden from the public catalog until
-- an admin verifies them.
drop policy if exists "products_select_public" on public.products;
create policy "products_select_public" on public.products
  for select using (
    verification_status = 'verified'
    or public.is_admin()
    or submitted_by = auth.uid()
  );

-- Any authenticated user may submit a pending product; admins verify later.
-- (Admin-only insert remains via the existing products_insert_admin policy.)
create policy "products_insert_pending_submission" on public.products
  for insert with check (
    auth.uid() is not null
    and verification_status = 'pending'
  );

-- ---------------------------------------------------------------------------
-- Storage bucket for product images: public read, authenticated upload.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product_images_authenticated_insert" on storage.objects;
create policy "product_images_authenticated_insert" on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
  );
