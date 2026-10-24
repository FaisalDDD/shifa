-- Shifa business and branch identity model.
-- Existing pharmacies remain the public branch/listing rows so existing
-- inventory, reservations, availability and membership foreign keys keep their
-- branch-local meaning. Every existing pharmacy is backfilled into one business
-- with itself as the initial branch.

create type public.business_membership_role as enum ('owner', 'admin');

create table public.pharmacy_businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  registration_email text,
  verification_status public.verification_status not null default 'pending',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pharmacy_businesses_status_idx
  on public.pharmacy_businesses (verification_status, is_active);

create table public.pharmacy_business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.pharmacy_businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_role public.business_membership_role not null default 'admin',
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index pharmacy_business_members_user_idx
  on public.pharmacy_business_members (user_id, business_id);

alter table public.pharmacies
  add column business_id uuid references public.pharmacy_businesses(id) on delete cascade,
  add column branch_name text not null default 'Main branch',
  add column branch_code text not null default 'MAIN',
  add column is_headquarters boolean not null default true;

-- Preserve every existing pharmacy and owner. Existing pharmacy IDs remain
-- branch IDs, so no operational foreign key needs to be rewritten.
do $$
declare
  pharmacy_row record;
  new_business_id uuid;
begin
  for pharmacy_row in
    select
      p.id,
      p.name,
      p.slug,
      p.verification_status,
      p.is_active,
      p.created_at,
      p.updated_at,
      owner.user_id as owner_user_id,
      owner_profile.email as owner_email
    from public.pharmacies p
    left join lateral (
      select pm.user_id
      from public.pharmacy_members pm
      where pm.pharmacy_id = p.id and pm.membership_role = 'owner'
      order by pm.created_at
      limit 1
    ) owner on true
    left join public.profiles owner_profile on owner_profile.id = owner.user_id
    where p.business_id is null
  loop
    new_business_id := gen_random_uuid();
    insert into public.pharmacy_businesses (
      id, name, slug, registration_email, verification_status,
      is_active, created_by, created_at, updated_at
    ) values (
      new_business_id,
      pharmacy_row.name,
      pharmacy_row.slug || '-business',
      pharmacy_row.owner_email,
      pharmacy_row.verification_status,
      pharmacy_row.is_active,
      pharmacy_row.owner_user_id,
      pharmacy_row.created_at,
      pharmacy_row.updated_at
    );

    update public.pharmacies
    set business_id = new_business_id,
        branch_name = name,
        branch_code = 'MAIN'
    where id = pharmacy_row.id;

    if pharmacy_row.owner_user_id is not null then
      insert into public.pharmacy_business_members (business_id, user_id, membership_role)
      values (new_business_id, pharmacy_row.owner_user_id, 'owner')
      on conflict (business_id, user_id) do update
        set membership_role = 'owner';
    end if;
  end loop;
end $$;

alter table public.pharmacies
  alter column business_id set not null;

create index pharmacies_business_idx on public.pharmacies (business_id, is_headquarters);
create unique index pharmacies_business_branch_code_idx
  on public.pharmacies (business_id, branch_code);

-- Business membership is intentionally separate from branch membership. A
-- business owner can authorize branch selection without granting every user
-- business-wide administration rights.
create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pharmacy_business_members
    where business_id = target_business_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_business_owner(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pharmacy_business_members
    where business_id = target_business_id
      and user_id = auth.uid()
      and membership_role = 'owner'
  );
$$;

revoke all on function public.is_business_member(uuid) from public;
revoke all on function public.is_business_owner(uuid) from public;
grant execute on function public.is_business_member(uuid) to authenticated, anon;
grant execute on function public.is_business_owner(uuid) to authenticated, anon;

alter table public.pharmacy_businesses enable row level security;
create policy "businesses_select_members_or_admin" on public.pharmacy_businesses
  for select using (public.is_admin() or public.is_business_member(id));
create policy "businesses_update_owner_or_admin" on public.pharmacy_businesses
  for update
  using (public.is_admin() or public.is_business_owner(id))
  with check (public.is_admin() or public.is_business_owner(id));

alter table public.pharmacy_business_members enable row level security;
create policy "business_members_select_scoped" on public.pharmacy_business_members
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_business_member(business_id)
  );
create policy "business_members_insert_owner_or_admin" on public.pharmacy_business_members
  for insert with check (public.is_admin() or public.is_business_owner(business_id));
create policy "business_members_update_owner_or_admin" on public.pharmacy_business_members
  for update
  using (public.is_admin() or public.is_business_owner(business_id))
  with check (public.is_admin() or public.is_business_owner(business_id));
create policy "business_members_delete_owner_or_admin" on public.pharmacy_business_members
  for delete using (public.is_admin() or public.is_business_owner(business_id));

-- New self-serve pharmacy registration creates a business and an initial branch
-- atomically. Direct clients cannot choose a business they do not own.
create or replace function public.prepare_pharmacy_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_id uuid;
  creator uuid := auth.uid();
begin
  if new.business_id is not null
     and not (public.is_admin() or public.is_business_owner(new.business_id)) then
    raise exception 'Only the business owner can register a branch';
  end if;

  if new.business_id is null then
    new_business_id := gen_random_uuid();
    insert into public.pharmacy_businesses (
      id, name, slug, registration_email, verification_status,
      is_active, created_by
    )
    select
      new_business_id,
      new.name,
      new.slug || '-business-' || left(new.id::text, 8),
      p.email,
      'pending',
      true,
      creator
    from public.profiles p
    where p.id = creator;

    if not found then
      insert into public.pharmacy_businesses (
        id, name, slug, verification_status, is_active, created_by
      ) values (
        new_business_id, new.name,
        new.slug || '-business-' || left(new.id::text, 8),
        'pending', true, creator
      );
    end if;
    new.business_id := new_business_id;
  end if;
  return new;
end;
$$;

create trigger pharmacies_prepare_business
  before insert on public.pharmacies
  for each row execute function public.prepare_pharmacy_business();

-- Extend the existing owner trigger so an initial registration receives both
-- branch access and business-level ownership. Branch verification remains
-- independent: a new branch is never auto-approved by this trigger.
create or replace function public.assign_pharmacy_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into public.pharmacy_members (pharmacy_id, user_id, membership_role)
    values (new.id, auth.uid(), 'owner')
    on conflict (pharmacy_id, user_id) do nothing;

    insert into public.pharmacy_business_members (business_id, user_id, membership_role)
    values (new.business_id, auth.uid(), 'owner')
    on conflict (business_id, user_id) do update
      set membership_role = 'owner';
  end if;
  return new;
end;
$$;

-- Business member lookup is useful for branch selection but never replaces the
-- branch-level membership check used by stock and operational writes.
comment on table public.pharmacy_businesses is
  'One business may own multiple pharmacy branch listings; branch operational data remains keyed by pharmacies.id.';
-- Direct authenticated inserts may create a new business (business_id left
-- null) or register a branch under a business the caller owns. The BEFORE
-- trigger fills business_id for new businesses and rejects unowned branch
-- attaches, so a single pending insert policy suffices.
drop policy if exists "pharmacies_insert_authenticated_pending" on public.pharmacies;
drop policy if exists "pharmacies_insert_new_business_pending" on public.pharmacies;
drop policy if exists "pharmacies_insert_business_branch_pending" on public.pharmacies;
create policy "pharmacies_insert_pending" on public.pharmacies
  for insert
  with check (
    auth.uid() is not null
    and verification_status = 'pending'
    and is_demo = false
  );
