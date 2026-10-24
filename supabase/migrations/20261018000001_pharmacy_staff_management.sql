-- Staff profiles, configurable working hours and pharmacy leave management.
-- These records are accessed through the trusted pharmacy-team function.

create table public.pharmacy_staff_settings (
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  employee_user_id uuid not null references public.profiles(id) on delete cascade,
  employee_code text not null default ('SHF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  display_name text,
  job_title text not null default 'Pharmacy staff',
  display_color text not null default '#2563eb',
  avatar_data_url text,
  weekly_target_hours numeric(4,1) not null default 40 check (weekly_target_hours between 0 and 80),
  working_days smallint[] not null default array[1,2,3,4,5]::smallint[]
    check (working_days <@ array[1,2,3,4,5,6,7]::smallint[]),
  shift_start time not null default '09:00',
  shift_end time not null default '17:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pharmacy_id, employee_user_id),
  unique (pharmacy_id, employee_code),
  check (shift_start < shift_end),
  check (avatar_data_url is null or length(avatar_data_url) <= 400000)
);

create index pharmacy_staff_settings_pharmacy_idx
  on public.pharmacy_staff_settings(pharmacy_id, employee_user_id);

create trigger pharmacy_staff_settings_set_updated_at
  before update on public.pharmacy_staff_settings
  for each row execute function public.set_updated_at();

alter table public.pharmacy_staff_settings enable row level security;
revoke all on public.pharmacy_staff_settings from anon, authenticated;
grant select, insert, update, delete on public.pharmacy_staff_settings to service_role;

create or replace function public.initialize_pharmacy_staff_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.pharmacy_staff_settings(pharmacy_id, employee_user_id)
  values (new.pharmacy_id, new.user_id)
  on conflict (pharmacy_id, employee_user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.initialize_pharmacy_staff_settings() from public, anon, authenticated;
drop trigger if exists pharmacy_members_initialize_staff_settings on public.pharmacy_members;
create trigger pharmacy_members_initialize_staff_settings
  after insert on public.pharmacy_members
  for each row execute function public.initialize_pharmacy_staff_settings();

insert into public.pharmacy_staff_settings(pharmacy_id, employee_user_id)
select pharmacy_id, user_id from public.pharmacy_members
on conflict (pharmacy_id, employee_user_id) do nothing;

create table public.pharmacy_leave_requests (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  employee_user_id uuid not null references public.profiles(id) on delete cascade,
  leave_type text not null check (leave_type in ('sick', 'annual', 'personal')),
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (reason is null or length(reason) <= 500)
);

create index pharmacy_leave_requests_pharmacy_dates_idx
  on public.pharmacy_leave_requests(pharmacy_id, start_date, end_date);
create index pharmacy_leave_requests_employee_idx
  on public.pharmacy_leave_requests(employee_user_id, created_at desc);

alter table public.pharmacy_leave_requests enable row level security;
revoke all on public.pharmacy_leave_requests from anon, authenticated;
grant select, insert, update, delete on public.pharmacy_leave_requests to service_role;
