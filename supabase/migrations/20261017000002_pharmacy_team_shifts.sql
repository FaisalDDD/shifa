-- Pharmacy owner managed staff and schedules.
-- Platform administrators remain separate from pharmacy owners.

create table public.pharmacy_shifts (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  employee_user_id uuid not null references public.profiles(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time <> start_time),
  unique (pharmacy_id, employee_user_id, shift_date, start_time)
);

create index pharmacy_shifts_pharmacy_date_idx on public.pharmacy_shifts(pharmacy_id, shift_date, start_time);
create index pharmacy_shifts_employee_date_idx on public.pharmacy_shifts(employee_user_id, shift_date);
create trigger pharmacy_shifts_set_updated_at before update on public.pharmacy_shifts
  for each row execute function public.set_updated_at();

create or replace function public.is_pharmacy_owner(target_pharmacy_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pharmacy_members pm
    where pm.pharmacy_id = target_pharmacy_id and pm.user_id = auth.uid() and pm.membership_role = 'owner');
$$;
revoke all on function public.is_pharmacy_owner(uuid) from public;
grant execute on function public.is_pharmacy_owner(uuid) to authenticated;

alter table public.pharmacy_shifts enable row level security;
create policy pharmacy_shifts_select_member on public.pharmacy_shifts for select using (
  employee_user_id = auth.uid() or public.is_admin() or public.is_pharmacy_owner(pharmacy_id)
);
create policy pharmacy_shifts_insert_owner on public.pharmacy_shifts for insert with check (
  created_by = auth.uid()
  and exists (select 1 from public.pharmacy_members pm where pm.pharmacy_id = pharmacy_shifts.pharmacy_id
    and pm.user_id = auth.uid() and pm.membership_role = 'owner')
  and exists (select 1 from public.pharmacy_members employee where employee.pharmacy_id = pharmacy_shifts.pharmacy_id
    and employee.user_id = pharmacy_shifts.employee_user_id)
);
create policy pharmacy_shifts_update_owner on public.pharmacy_shifts for update
  using (exists (select 1 from public.pharmacy_members pm where pm.pharmacy_id = pharmacy_shifts.pharmacy_id
    and pm.user_id = auth.uid() and pm.membership_role = 'owner'))
  with check (exists (select 1 from public.pharmacy_members pm where pm.pharmacy_id = pharmacy_shifts.pharmacy_id
    and pm.user_id = auth.uid() and pm.membership_role = 'owner')
    and created_by = auth.uid()
    and exists (select 1 from public.pharmacy_members employee
      where employee.pharmacy_id = pharmacy_shifts.pharmacy_id
        and employee.user_id = pharmacy_shifts.employee_user_id));
create policy pharmacy_shifts_delete_owner on public.pharmacy_shifts for delete using (
  exists (select 1 from public.pharmacy_members pm where pm.pharmacy_id = pharmacy_shifts.pharmacy_id
    and pm.user_id = auth.uid() and pm.membership_role = 'owner')
);

-- Owners can see their own team. Only the trusted invitation function can add
-- a team member; owners can remove staff but cannot remove/change owners.
drop policy if exists "members_select_own_or_admin" on public.pharmacy_members;
create policy members_select_own_owner_admin on public.pharmacy_members for select using (
  user_id = auth.uid() or public.is_admin() or public.is_pharmacy_owner(pharmacy_id)
);
create policy members_delete_owner_admin on public.pharmacy_members for delete using (
  public.is_admin() or (membership_role = 'staff' and public.is_pharmacy_owner(pharmacy_id))
);
grant select, insert, update, delete on public.pharmacy_shifts to authenticated;
