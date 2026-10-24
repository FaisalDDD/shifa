-- Pharmacy finance: an append-only, pharmacy-scoped journal event stream.
-- Monetary journal lines are fixed-point integer minor units in the client;
-- Supabase stores the signed event payload without changing its precision.

create table if not exists public.pharmacy_financial_events (
  id uuid not null,
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key (pharmacy_id, id)
);

alter table public.pharmacy_financial_events enable row level security;
drop policy if exists financial_events_select_owner on public.pharmacy_financial_events;
create policy financial_events_select_owner on public.pharmacy_financial_events
  for select using (
    public.is_admin() or exists (
      select 1 from public.pharmacy_members pm
      where pm.pharmacy_id = pharmacy_financial_events.pharmacy_id
        and pm.user_id = auth.uid()
        and pm.membership_role::text = 'owner'
    )
  );
revoke insert, update, delete on public.pharmacy_financial_events from anon, authenticated;
grant select on public.pharmacy_financial_events to authenticated;

create table if not exists public.pharmacy_financial_periods (
  id uuid not null,
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  state text not null check (state in ('closed','reopened')),
  closed_at timestamptz not null,
  closed_by uuid references public.profiles(id) on delete set null,
  snapshot_json jsonb not null,
  reopened_at timestamptz,
  reopened_by uuid references public.profiles(id) on delete set null,
  reopen_reason text,
  last_event_id uuid not null,
  unique (pharmacy_id, period_start, period_end),
  check (period_start <= period_end)
);
create table if not exists public.pharmacy_financial_period_events (
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key (pharmacy_id, id)
);
alter table public.pharmacy_financial_periods enable row level security;
alter table public.pharmacy_financial_period_events enable row level security;
create policy financial_periods_select_owner on public.pharmacy_financial_periods
  for select using (public.is_admin() or exists (
    select 1 from public.pharmacy_members pm where pm.pharmacy_id=pharmacy_financial_periods.pharmacy_id
      and pm.user_id=auth.uid() and pm.membership_role::text='owner'
  ));
create policy financial_period_events_select_owner on public.pharmacy_financial_period_events
  for select using (public.is_admin() or exists (
    select 1 from public.pharmacy_members pm where pm.pharmacy_id=pharmacy_financial_period_events.pharmacy_id
      and pm.user_id=auth.uid() and pm.membership_role::text='owner'
  ));
revoke insert, update, delete on public.pharmacy_financial_periods, public.pharmacy_financial_period_events from anon, authenticated;
grant select on public.pharmacy_financial_periods, public.pharmacy_financial_period_events to authenticated;

create or replace function public.apply_pharmacy_financial_period_event(
  p_pharmacy_id uuid, p_event_id uuid, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  p jsonb := p_payload->'period';
  action text := p_payload->>'action';
  inserted_count integer;
  existing_payload jsonb;
begin
  if not (public.is_admin() or exists (
    select 1 from public.pharmacy_members pm where pm.pharmacy_id=p_pharmacy_id
      and pm.user_id=auth.uid() and pm.membership_role::text='owner'
  )) then raise exception 'Only the pharmacy owner can close or reopen a financial period'; end if;
  if p_payload->>'event_id' is distinct from p_event_id::text
     or coalesce(jsonb_typeof(p), 'null') <> 'object'
     or action is null or action not in ('close','reopen')
     or nullif(p->>'id','') is null
     or (p->>'period_start')::date > (p->>'period_end')::date then
    raise exception 'Invalid financial period event';
  end if;
  insert into public.pharmacy_financial_period_events(pharmacy_id,id,payload,created_by)
    values(p_pharmacy_id,p_event_id,p_payload,auth.uid()) on conflict(pharmacy_id,id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count=0 then
    select payload into existing_payload from public.pharmacy_financial_period_events where pharmacy_id=p_pharmacy_id and id=p_event_id;
    if existing_payload is distinct from p_payload then raise exception 'Financial period event id was reused with different content'; end if;
    return jsonb_build_object('applied',false,'duplicate',true);
  end if;

  if action='close' then
    if exists(select 1 from public.pharmacy_financial_periods f where f.pharmacy_id=p_pharmacy_id
      and f.state='closed' and not (f.period_end < (p->>'period_start')::date or f.period_start > (p->>'period_end')::date)
      and (f.period_start,f.period_end) <> ((p->>'period_start')::date,(p->>'period_end')::date)) then
      raise exception 'This period overlaps another closed financial period';
    end if;
    insert into public.pharmacy_financial_periods(id,pharmacy_id,period_start,period_end,state,closed_at,closed_by,snapshot_json,reopened_at,reopened_by,reopen_reason,last_event_id)
      values((p->>'id')::uuid,p_pharmacy_id,(p->>'period_start')::date,(p->>'period_end')::date,'closed',
        (p->>'closed_at')::timestamptz,(nullif(p->>'closed_by',''))::uuid,(p->>'snapshot_json')::jsonb,null,null,null,p_event_id)
      on conflict(pharmacy_id,period_start,period_end) do update set id=excluded.id,state='closed',closed_at=excluded.closed_at,
        closed_by=excluded.closed_by,snapshot_json=excluded.snapshot_json,reopened_at=null,reopened_by=null,reopen_reason=null,last_event_id=p_event_id;
  else
    if length(trim(coalesce(p->>'reopen_reason',''))) < 8 then raise exception 'A reason is required to reopen a period'; end if;
    update public.pharmacy_financial_periods set state='reopened',reopened_at=(p->>'reopened_at')::timestamptz,
      reopened_by=(nullif(p->>'reopened_by',''))::uuid,reopen_reason=p->>'reopen_reason',last_event_id=p_event_id
      where pharmacy_id=p_pharmacy_id and period_start=(p->>'period_start')::date and period_end=(p->>'period_end')::date and state='closed';
    if not found then raise exception 'Financial period is not closed'; end if;
  end if;
  return jsonb_build_object('applied',true,'duplicate',false);
end;
$$;
revoke all on function public.apply_pharmacy_financial_period_event(uuid,uuid,jsonb) from public;
grant execute on function public.apply_pharmacy_financial_period_event(uuid,uuid,jsonb) to authenticated;

create or replace function public.apply_pharmacy_financial_event(
  p_pharmacy_id uuid,
  p_event_id uuid,
  p_event_type text,
  p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  inserted_count integer;
  debits numeric;
  credits numeric;
  existing_payload jsonb;
  owner_access boolean;
begin
  owner_access := public.is_admin() or exists (
    select 1 from public.pharmacy_members pm
    where pm.pharmacy_id = p_pharmacy_id and pm.user_id = auth.uid()
      and pm.membership_role::text = 'owner'
  );
  if not (owner_access or public.is_pharmacy_member(p_pharmacy_id)) then
    raise exception 'Not authorized for this pharmacy';
  end if;
  if p_event_type is null or p_event_type not in ('sale', 'purchase', 'expense', 'stock_writeoff', 'supplier_payment', 'customer_payment') then
    raise exception 'Unsupported financial event type';
  end if;
  if not owner_access and p_event_type not in ('sale', 'purchase', 'customer_payment') then
    raise exception 'Only the pharmacy owner can post this financial event';
  end if;
  if p_payload->>'event_id' is distinct from p_event_id::text
     or p_payload->'journal' is null
     or nullif(p_payload->'journal'->>'id', '') is null
     or nullif(p_payload->'journal'->>'business_date', '') is null
     or (p_payload->'journal'->>'entry_type') is distinct from p_event_type
     or coalesce(jsonb_typeof(p_payload->'lines'), 'null') <> 'array' then
    raise exception 'Invalid financial event payload';
  end if;
  perform (p_payload->'journal'->>'business_date')::date;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'lines') as items(line)
    where coalesce((line->>'debit_minor')::numeric,0) < 0
       or coalesce((line->>'credit_minor')::numeric,0) < 0
       or (coalesce((line->>'debit_minor')::numeric,0) > 0 and coalesce((line->>'credit_minor')::numeric,0) > 0)
       or nullif(line->>'account_code','') is null
       or not (
         line->>'account_code' in ('cash_on_hand','bank','accounts_receivable','inventory','accounts_payable',
           'sales_revenue','cost_of_goods_sold','inventory_writeoff','expense:rent','expense:payroll',
           'expense:utilities','expense:transport','expense:maintenance','expense:bank_charges','expense:marketing','expense:other')
       )
  ) then raise exception 'Invalid financial journal line'; end if;
  if exists(select 1 from public.pharmacy_financial_periods f where f.pharmacy_id=p_pharmacy_id
    and f.state='closed' and (p_payload->'journal'->>'business_date')::date between f.period_start and f.period_end) then
    raise exception 'Financial period is closed; reopen it before posting a backdated event';
  end if;

  select coalesce(sum((line->>'debit_minor')::numeric), 0),
         coalesce(sum((line->>'credit_minor')::numeric), 0)
    into debits, credits
    from jsonb_array_elements(p_payload->'lines') as items(line);
  if debits <> credits then raise exception 'Financial event is not balanced'; end if;

  insert into public.pharmacy_financial_events(id, pharmacy_id, event_type, payload, created_by)
    values (p_event_id, p_pharmacy_id, p_event_type, p_payload, auth.uid())
    on conflict (pharmacy_id, id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    select payload into existing_payload from public.pharmacy_financial_events
      where pharmacy_id = p_pharmacy_id and id = p_event_id;
    if existing_payload is distinct from p_payload then raise exception 'Financial event id was reused with different content'; end if;
    return jsonb_build_object('applied', false, 'duplicate', true);
  end if;
  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;
revoke all on function public.apply_pharmacy_financial_event(uuid, uuid, text, jsonb) from public;
grant execute on function public.apply_pharmacy_financial_event(uuid, uuid, text, jsonb) to authenticated;

-- Financial rate changes are owner controlled and retain an immutable event
-- trail, including the identity that entered the rate.
create or replace function public.set_pharmacy_daily_exchange_rate(
  p_pharmacy_id uuid, p_event_id uuid, p_business_date date, p_sdg_per_usd numeric
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare inserted_count integer;
begin
  if not (public.is_admin() or exists (
    select 1 from public.pharmacy_members pm
    where pm.pharmacy_id = p_pharmacy_id and pm.user_id = auth.uid()
      and pm.membership_role::text = 'owner'
  )) then
    raise exception 'Only the pharmacy owner can set financial exchange rates';
  end if;
  if p_sdg_per_usd <= 0 then raise exception 'Exchange rate must be positive'; end if;
  if exists(select 1 from public.pharmacy_financial_periods f where f.pharmacy_id=p_pharmacy_id
    and f.state='closed' and p_business_date between f.period_start and f.period_end) then
    raise exception 'Financial period is closed; reopen it before changing an exchange rate';
  end if;
  insert into public.pharmacy_exchange_rate_events(id, pharmacy_id, business_date, sdg_per_usd, created_by)
    values (p_event_id, p_pharmacy_id, p_business_date, p_sdg_per_usd, auth.uid())
    on conflict (pharmacy_id, id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return jsonb_build_object('applied', false, 'duplicate', true); end if;
  insert into public.pharmacy_daily_exchange_rates(pharmacy_id, business_date, sdg_per_usd, updated_at, updated_by)
    values (p_pharmacy_id, p_business_date, p_sdg_per_usd, now(), auth.uid())
    on conflict (pharmacy_id, business_date) do update set sdg_per_usd=excluded.sdg_per_usd,
      updated_at=now(), updated_by=auth.uid();
  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;
revoke all on function public.set_pharmacy_daily_exchange_rate(uuid, uuid, date, numeric) from public;
grant execute on function public.set_pharmacy_daily_exchange_rate(uuid, uuid, date, numeric) to authenticated;
