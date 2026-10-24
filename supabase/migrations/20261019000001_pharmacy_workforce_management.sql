-- Workforce foundations for Shifa Pro. Sensitive HR rows are only accessed by
-- the pharmacy-team edge function, which validates membership and role.

alter table public.pharmacy_staff_settings
  add column if not exists employment_status text not null default 'active',
  add column if not exists department text,
  add column if not exists location text,
  add column if not exists manager_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists contract_type text,
  add column if not exists start_date date,
  add column if not exists end_date date;

alter table public.pharmacy_staff_settings
  drop constraint if exists pharmacy_staff_settings_employment_status_check;
alter table public.pharmacy_staff_settings
  add constraint pharmacy_staff_settings_employment_status_check
  check (employment_status in ('active', 'on_leave', 'suspended', 'deactivated'));
alter table public.pharmacy_staff_settings
  add constraint pharmacy_staff_settings_department_length_check
  check (department is null or length(department) <= 80);
alter table public.pharmacy_staff_settings
  add constraint pharmacy_staff_settings_location_length_check
  check (location is null or length(location) <= 100);
alter table public.pharmacy_staff_settings
  add constraint pharmacy_staff_settings_contract_type_length_check
  check (contract_type is null or length(contract_type) <= 60);
alter table public.pharmacy_staff_settings
  add constraint pharmacy_staff_settings_end_after_start_check
  check (end_date is null or start_date is null or end_date >= start_date);

update public.pharmacy_staff_settings settings
set start_date = member.created_at::date
from public.pharmacy_members member
where member.pharmacy_id = settings.pharmacy_id
  and member.user_id = settings.employee_user_id
  and settings.start_date is null;
update public.pharmacy_staff_settings set start_date = current_date where start_date is null;
alter table public.pharmacy_staff_settings alter column start_date set default current_date;
alter table public.pharmacy_staff_settings alter column start_date set not null;

create table if not exists public.pharmacy_workforce_settings (
  pharmacy_id uuid primary key references public.pharmacies(id) on delete cascade,
  timezone text not null default 'Africa/Khartoum',
  currency char(3) not null default 'SDG',
  week_starts_on smallint not null default 1 check (week_starts_on between 1 and 7),
  attendance_enabled boolean not null default false,
  payroll_preparation_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (currency ~ '^[A-Z]{3}$'),
  check (length(timezone) between 1 and 80)
);

insert into public.pharmacy_workforce_settings(pharmacy_id)
select id from public.pharmacies on conflict (pharmacy_id) do nothing;

create trigger pharmacy_workforce_settings_set_updated_at
  before update on public.pharmacy_workforce_settings
  for each row execute function public.set_updated_at();

alter table public.pharmacy_shifts
  add column if not exists status text not null default 'draft',
  add column if not exists location text,
  add column if not exists role_label text,
  add column if not exists break_minutes smallint not null default 0,
  add column if not exists timezone text not null default 'Africa/Khartoum',
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.profiles(id) on delete set null;

-- Existing assignments were visible to employees before publication existed.
update public.pharmacy_shifts set status = 'published' where status = 'draft';
alter table public.pharmacy_shifts
  add constraint pharmacy_shifts_status_check
  check (status in ('draft', 'published', 'cancelled'));
alter table public.pharmacy_shifts
  add constraint pharmacy_shifts_break_minutes_check
  check (break_minutes between 0 and 600);
alter table public.pharmacy_shifts
  add constraint pharmacy_shifts_location_length_check
  check (location is null or length(location) <= 100);
alter table public.pharmacy_shifts
  add constraint pharmacy_shifts_role_label_length_check
  check (role_label is null or length(role_label) <= 80);

alter table public.pharmacy_leave_requests
  drop constraint if exists pharmacy_leave_requests_leave_type_check;
alter table public.pharmacy_leave_requests
  add constraint pharmacy_leave_requests_leave_type_check
  check (leave_type in ('sick', 'annual', 'personal', 'unpaid', 'family'));
alter table public.pharmacy_leave_requests
  drop constraint if exists pharmacy_leave_requests_status_check;
alter table public.pharmacy_leave_requests
  add constraint pharmacy_leave_requests_status_check
  check (status in ('pending', 'needs_information', 'approved', 'rejected', 'cancelled', 'withdrawn'));
alter table public.pharmacy_leave_requests
  add column if not exists review_reason text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.pharmacy_hr_audit_events (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists pharmacy_hr_audit_events_pharmacy_time_idx
  on public.pharmacy_hr_audit_events(pharmacy_id, occurred_at desc);
create index if not exists pharmacy_hr_audit_events_entity_idx
  on public.pharmacy_hr_audit_events(entity_type, entity_id, occurred_at desc);

create table if not exists public.pharmacy_hr_notifications (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  delivery_status text not null default 'in_app' check (delivery_status in ('in_app', 'failed')),
  check (length(title) between 1 and 120),
  check (length(body) between 1 and 500)
);
create index if not exists pharmacy_hr_notifications_recipient_idx
  on public.pharmacy_hr_notifications(recipient_user_id, created_at desc);

create table if not exists public.pharmacy_employee_compensation (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  employee_user_id uuid not null references public.profiles(id) on delete cascade,
  effective_date date not null,
  pay_basis text not null check (pay_basis in ('day', 'week', 'month', 'hour', 'annual')),
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null default 'SDG' check (currency ~ '^[A-Z]{3}$'),
  pay_schedule text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (pay_schedule is null or length(pay_schedule) <= 80)
);
create index if not exists pharmacy_employee_compensation_history_idx
  on public.pharmacy_employee_compensation(pharmacy_id, employee_user_id, effective_date desc);
create unique index if not exists pharmacy_employee_compensation_effective_date_uq
  on public.pharmacy_employee_compensation(pharmacy_id, employee_user_id, effective_date);

create table if not exists public.pharmacy_attendance_events (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  employee_user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('clock_in', 'clock_out', 'break_start', 'break_end')),
  occurred_at timestamptz not null default now(),
  source text not null default 'employee_portal',
  device_ref text,
  created_at timestamptz not null default now()
);
create index if not exists pharmacy_attendance_events_employee_time_idx
  on public.pharmacy_attendance_events(pharmacy_id, employee_user_id, occurred_at desc);

create table if not exists public.pharmacy_time_correction_requests (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  employee_user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.pharmacy_attendance_events(id) on delete set null,
  requested_event_type text not null check (requested_event_type in ('clock_in', 'clock_out', 'break_start', 'break_end')),
  requested_at timestamptz not null,
  reason text not null check (length(reason) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now()
);
create index if not exists pharmacy_time_correction_requests_idx
  on public.pharmacy_time_correction_requests(pharmacy_id, status, created_at desc);

create table if not exists public.pharmacy_shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  shift_id uuid not null references public.pharmacy_shifts(id) on delete restrict,
  employee_user_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (employee_user_id <> target_user_id),
  check (note is null or length(note) <= 500),
  check (review_reason is null or length(review_reason) <= 500)
);
create index if not exists pharmacy_shift_swap_requests_pharmacy_idx
  on public.pharmacy_shift_swap_requests(pharmacy_id, status, created_at desc);
create index if not exists pharmacy_shift_swap_requests_employee_idx
  on public.pharmacy_shift_swap_requests(employee_user_id, created_at desc);
create index if not exists pharmacy_shift_swap_requests_target_idx
  on public.pharmacy_shift_swap_requests(target_user_id, created_at desc);

-- Raw clock records are evidence; corrections must be represented separately.
create or replace function public.prevent_pharmacy_attendance_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Attendance events are immutable; create a correction request instead.';
end;
$$;
drop trigger if exists pharmacy_attendance_events_immutable on public.pharmacy_attendance_events;
create trigger pharmacy_attendance_events_immutable
  before update or delete on public.pharmacy_attendance_events
  for each row execute function public.prevent_pharmacy_attendance_event_mutation();

alter table public.pharmacy_workforce_settings enable row level security;
alter table public.pharmacy_hr_audit_events enable row level security;
alter table public.pharmacy_hr_notifications enable row level security;
alter table public.pharmacy_employee_compensation enable row level security;
alter table public.pharmacy_attendance_events enable row level security;
alter table public.pharmacy_time_correction_requests enable row level security;
alter table public.pharmacy_shift_swap_requests enable row level security;

revoke all on public.pharmacy_workforce_settings, public.pharmacy_hr_audit_events,
  public.pharmacy_hr_notifications, public.pharmacy_employee_compensation,
  public.pharmacy_attendance_events, public.pharmacy_time_correction_requests,
  public.pharmacy_shift_swap_requests
  from anon, authenticated;
grant select, insert, update on public.pharmacy_workforce_settings to service_role;
grant select, insert on public.pharmacy_hr_audit_events to service_role;
grant select, insert, update on public.pharmacy_hr_notifications to service_role;
grant select, insert on public.pharmacy_employee_compensation to service_role;
grant select, insert on public.pharmacy_attendance_events to service_role;
grant select, insert, update on public.pharmacy_time_correction_requests to service_role;
grant select, insert, update on public.pharmacy_shift_swap_requests to service_role;
