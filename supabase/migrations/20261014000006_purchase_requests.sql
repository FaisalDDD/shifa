-- Shifa — B2B purchase requests + self-serve pharmacy registration.

create type public.purchase_request_status as enum ('REQUESTED', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- A pharmacy requests to buy a large quantity of a product from another pharmacy.
create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  seller_pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status public.purchase_request_status not null default 'REQUESTED',
  notes text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_pharmacy_id <> seller_pharmacy_id)
);

create index purchase_requests_buyer_idx on public.purchase_requests (buyer_pharmacy_id, created_at desc);
create index purchase_requests_seller_idx on public.purchase_requests (seller_pharmacy_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Self-serve pharmacy registration: an authenticated user may create ONE
-- pharmacy as a *pending* (unverified) listing. They can never self-verify.
-- ---------------------------------------------------------------------------

create policy "pharmacies_insert_authenticated_pending" on public.pharmacies
  for insert
  with check (
    auth.uid() is not null
    and verification_status = 'pending'
    and is_demo = false
  );

-- ---------------------------------------------------------------------------
-- purchase_requests RLS
-- ---------------------------------------------------------------------------

alter table public.purchase_requests enable row level security;

create policy "purchase_select_member_or_admin" on public.purchase_requests
  for select using (
    public.is_pharmacy_member(buyer_pharmacy_id)
    or public.is_pharmacy_member(seller_pharmacy_id)
    or public.is_admin()
  );

create policy "purchase_insert_buyer_requested" on public.purchase_requests
  for insert with check (
    public.is_pharmacy_member(buyer_pharmacy_id)
    and status = 'REQUESTED'
  );

create policy "purchase_update_member_or_admin" on public.purchase_requests
  for update
  using (
    public.is_pharmacy_member(buyer_pharmacy_id)
    or public.is_pharmacy_member(seller_pharmacy_id)
    or public.is_admin()
  )
  with check (
    public.is_pharmacy_member(buyer_pharmacy_id)
    or public.is_pharmacy_member(seller_pharmacy_id)
    or public.is_admin()
  );

-- No DELETE policy: purchase requests are preserved as an audit trail.

-- ---------------------------------------------------------------------------
-- State machine guard (REQUESTED -> ACCEPTED | REJECTED | CANCELLED)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_purchase_request_transitions()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if old.status = 'REQUESTED' then
      if new.status not in ('ACCEPTED', 'REJECTED', 'CANCELLED') then
        raise exception 'Invalid transition from REQUESTED to %', new.status;
      end if;
    else
      raise exception 'Cannot transition from terminal state %', old.status;
    end if;

    if new.status in ('ACCEPTED', 'REJECTED')
       and auth.uid() is not null
       and not (public.is_admin() or public.is_pharmacy_member(new.seller_pharmacy_id)) then
      raise exception 'Only the seller pharmacy can % a purchase request', new.status;
    end if;

    if new.status = 'CANCELLED'
       and auth.uid() is not null
       and not (public.is_admin() or public.is_pharmacy_member(new.buyer_pharmacy_id)) then
      raise exception 'Only the buyer pharmacy can cancel a purchase request';
    end if;
  end if;
  return new;
end;
$$;

create trigger purchase_requests_enforce_transitions
  before update on public.purchase_requests
  for each row execute function public.enforce_purchase_request_transitions();

create trigger purchase_requests_set_updated_at before update on public.purchase_requests
  for each row execute function public.set_updated_at();
