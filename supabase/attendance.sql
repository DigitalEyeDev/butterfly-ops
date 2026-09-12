-- =========================================================================
-- BUTTERFLY OPS — Attendance & Staff Presence module
-- Run this once, after schema.sql and storage.sql, in the Supabase SQL
-- editor. Safe to re-run.
--
-- Design summary:
--  - Event-sourced: attendance_events is append-only and is the source of
--    truth; attendance_records is a small derived-state row per person
--    per day, kept in sync by the RPCs below — clients never write to
--    either table directly (no INSERT/UPDATE/DELETE policy exists for
--    any role), only through record_attendance_event / manager_adjust_attendance.
--  - The server clock is authoritative for every timestamp; a client can
--    send whatever GPS/accuracy/permission values it wants, but never a
--    timestamp, a user id, or a status — all of that is derived server-side.
--  - Status is deliberately small (NOT_STARTED/PRESENT/ON_LUNCH/CLOCKED_OUT).
--    "Lunch exceeded", "missing clock-out", and "late arrival" are computed
--    from timestamps at read time rather than stored, since there is no
--    clock-driven job to flip a stored status at the 30-minute mark or at
--    midnight — computing them fresh is both simpler and always correct.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Branch-level attendance configuration. Nullable lat/lng on purpose:
-- until a manager configures the park's coordinates, attendance still
-- works (staff can still clock in/out for payroll purposes) — location
-- verification just reports ZONE_NOT_CONFIGURED instead of blocking them.
-- ---------------------------------------------------------------------
alter table branches add column if not exists attendance_lat double precision;
alter table branches add column if not exists attendance_lng double precision;
alter table branches add column if not exists attendance_radius_m integer not null default 150;
alter table branches add column if not exists expected_shift_minutes integer not null default 600;
alter table branches add column if not exists lunch_allowed_minutes integer not null default 30;
-- "Late arrival" needs a baseline scheduled start time to compare a
-- clock-in against — expected_shift_minutes alone (a duration) can't
-- express that. Stored as "HH:MM" in the branch's local (Asia/Kolkata) time.
alter table branches add column if not exists expected_start_time text not null default '10:00';

do $$ begin
  create type attendance_event_type as enum ('CLOCK_IN', 'LUNCH_START', 'LUNCH_END', 'CLOCK_OUT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_record_status as enum ('NOT_STARTED', 'PRESENT', 'ON_LUNCH', 'CLOCKED_OUT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_location_status as enum (
    'VERIFIED',
    'OUTSIDE_ZONE',
    'LOCATION_UNCERTAIN',
    'LOCATION_PERMISSION_DENIED',
    'LOCATION_UNAVAILABLE',
    'ZONE_NOT_CONFIGURED'
  );
exception when duplicate_object then null; end $$;

create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches (id),
  user_id uuid not null references profiles (id),
  attendance_date date not null,
  status attendance_record_status not null default 'NOT_STARTED',
  expected_shift_minutes int not null,
  lunch_allowed_minutes int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, attendance_date)
);

create index if not exists attendance_records_branch_date_idx on attendance_records (branch_id, attendance_date);
create index if not exists attendance_records_user_idx on attendance_records (user_id, attendance_date);

drop trigger if exists attendance_records_set_updated_at on attendance_records;
create trigger attendance_records_set_updated_at
  before update on attendance_records
  for each row execute function set_updated_at();

-- Append-only. `event_timestamp` defaults to `now()` and every RPC below
-- ignores any client-supplied time — the server clock is authoritative.
create table if not exists attendance_events (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references attendance_records (id) on delete cascade,
  branch_id uuid not null references branches (id),
  user_id uuid not null references profiles (id),
  event_type attendance_event_type not null,
  event_timestamp timestamptz not null default now(),
  timezone text not null default 'Asia/Kolkata',
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  distance_from_park_meters double precision,
  location_status attendance_location_status not null,
  evidence_image_path text,
  created_at timestamptz not null default now()
);

create index if not exists attendance_events_record_idx on attendance_events (attendance_record_id, event_timestamp);
create index if not exists attendance_events_user_idx on attendance_events (user_id, event_timestamp);
create index if not exists attendance_events_branch_idx on attendance_events (branch_id);

-- One row per manual correction — a manager can change a record's status
-- (e.g. a forgotten clock-out) only through the RPC below, which forces a
-- reason and logs the before/after here. Nothing ever overwrites this.
create table if not exists attendance_adjustments (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references attendance_records (id) on delete cascade,
  performed_by uuid not null references profiles (id),
  reason text not null,
  previous_status attendance_record_status,
  new_status attendance_record_status,
  created_at timestamptz not null default now()
);

create index if not exists attendance_adjustments_record_idx on attendance_adjustments (attendance_record_id);
create index if not exists attendance_adjustments_performed_by_idx on attendance_adjustments (performed_by);

-- =========================================================================
-- Haversine great-circle distance in meters — the standard formula for
-- short-range GPS distance checks like a geofence.
-- =========================================================================
create or replace function haversine_distance_meters(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql immutable set search_path = public as $$
  select 6371000 * 2 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$$;

-- =========================================================================
-- Row Level Security — no INSERT/UPDATE/DELETE policy exists for any of
-- the three tables below, for any role, ever. Every write happens inside
-- one of the two SECURITY DEFINER RPCs further down, which independently
-- re-derive the caller's identity, role, and branch, validate the event
-- sequence, and compute location/distance server-side — a client cannot
-- write a row directly no matter what it sends the API.
-- =========================================================================
alter table attendance_records enable row level security;
alter table attendance_events enable row level security;
alter table attendance_adjustments enable row level security;

drop policy if exists attendance_records_select on attendance_records;
create policy attendance_records_select on attendance_records for select
  using (
    branch_id = current_profile_branch()
    and (current_profile_role() in ('manager', 'owner') or user_id = (select auth.uid()))
  );

drop policy if exists attendance_events_select on attendance_events;
create policy attendance_events_select on attendance_events for select
  using (
    branch_id = current_profile_branch()
    and (current_profile_role() in ('manager', 'owner') or user_id = (select auth.uid()))
  );

drop policy if exists attendance_adjustments_select on attendance_adjustments;
create policy attendance_adjustments_select on attendance_adjustments for select
  using (
    current_profile_role() in ('manager', 'owner')
    and exists (
      select 1 from attendance_records r
      where r.id = attendance_adjustments.attendance_record_id
        and r.branch_id = current_profile_branch()
    )
  );

-- =========================================================================
-- RPC: record_attendance_event — the ONLY way a clock/lunch event is ever
-- created. One function covers all four event types since the shared
-- logic (auth, today's record, location scoring, status transition) is
-- ~90% identical; the event-specific bit is just the sequence check and
-- which status it moves to.
-- =========================================================================
create or replace function record_attendance_event(
  p_event_type attendance_event_type,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters double precision default null,
  p_location_permission text default 'granted',
  p_evidence_image_path text default null
)
returns attendance_events
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role;
  v_branch_id uuid;
  v_today date;
  v_record attendance_records%rowtype;
  v_distance double precision;
  v_location_status attendance_location_status;
  v_park_lat double precision;
  v_park_lng double precision;
  v_radius int;
  v_event attendance_events%rowtype;
  v_new_status attendance_record_status;
  v_lunch_already_taken boolean;
begin
  select role, branch_id into v_role, v_branch_id from profiles where id = auth.uid() and is_active;
  if v_role is null then
    raise exception 'Your account no longer has access to Butterfly Ops';
  end if;
  if v_role <> 'staff' then
    raise exception 'Only staff members clock in and out';
  end if;

  select attendance_lat, attendance_lng, attendance_radius_m
    into v_park_lat, v_park_lng, v_radius
    from branches where id = v_branch_id;

  v_today := (now() at time zone 'Asia/Kolkata')::date;

  select * into v_record from attendance_records
    where user_id = auth.uid() and attendance_date = v_today
    for update;

  if not found then
    insert into attendance_records (branch_id, user_id, attendance_date, status, expected_shift_minutes, lunch_allowed_minutes)
    select v_branch_id, auth.uid(), v_today, 'NOT_STARTED',
           b.expected_shift_minutes, b.lunch_allowed_minutes
    from branches b where b.id = v_branch_id
    returning * into v_record;
  end if;

  if p_event_type = 'CLOCK_IN' and v_record.status <> 'NOT_STARTED' then
    raise exception 'You have already clocked in today';
  end if;

  -- Each branch below gives a message specific to *why* the transition is
  -- invalid, rather than one generic message for every wrong state.
  if p_event_type = 'LUNCH_START' and v_record.status <> 'PRESENT' then
    if v_record.status = 'NOT_STARTED' then
      raise exception 'Clock in before starting lunch';
    elsif v_record.status = 'ON_LUNCH' then
      raise exception 'You are already on lunch';
    else
      raise exception 'You have already completed today''s shift';
    end if;
  end if;

  if p_event_type = 'LUNCH_END' and v_record.status <> 'ON_LUNCH' then
    raise exception 'You are not currently on lunch';
  end if;

  if p_event_type = 'CLOCK_OUT' and v_record.status <> 'PRESENT' then
    if v_record.status = 'NOT_STARTED' then
      raise exception 'Clock in before you can clock out';
    elsif v_record.status = 'ON_LUNCH' then
      raise exception 'End your lunch before clocking out';
    else
      raise exception 'You have already completed today''s shift';
    end if;
  end if;

  -- Spec: "for the current version, allow only ONE lunch break" — the
  -- event-sourced model already supports multiple lunch pairs (a future
  -- version just needs to relax this one check).
  if p_event_type = 'LUNCH_START' then
    select exists(
      select 1 from attendance_events
      where attendance_record_id = v_record.id and event_type = 'LUNCH_END'
    ) into v_lunch_already_taken;
    if v_lunch_already_taken then
      raise exception 'You have already taken your lunch break today';
    end if;
  end if;

  if p_location_permission = 'denied' then
    v_location_status := 'LOCATION_PERMISSION_DENIED';
    v_distance := null;
  elsif p_location_permission = 'unavailable' or p_latitude is null or p_longitude is null then
    v_location_status := 'LOCATION_UNAVAILABLE';
    v_distance := null;
  elsif v_park_lat is null or v_park_lng is null then
    v_location_status := 'ZONE_NOT_CONFIGURED';
    v_distance := null;
  else
    v_distance := haversine_distance_meters(p_latitude, p_longitude, v_park_lat, v_park_lng);
    if p_accuracy_meters is not null and p_accuracy_meters > 100 then
      v_location_status := 'LOCATION_UNCERTAIN';
    elsif v_distance <= v_radius then
      v_location_status := 'VERIFIED';
    else
      v_location_status := 'OUTSIDE_ZONE';
    end if;
  end if;

  insert into attendance_events (
    attendance_record_id, branch_id, user_id, event_type, event_timestamp, timezone,
    latitude, longitude, accuracy_meters, distance_from_park_meters, location_status, evidence_image_path
  ) values (
    v_record.id, v_branch_id, auth.uid(), p_event_type, now(), 'Asia/Kolkata',
    p_latitude, p_longitude, p_accuracy_meters, v_distance, v_location_status, p_evidence_image_path
  ) returning * into v_event;

  v_new_status := (case p_event_type
    when 'CLOCK_IN' then 'PRESENT'
    when 'LUNCH_START' then 'ON_LUNCH'
    when 'LUNCH_END' then 'PRESENT'
    when 'CLOCK_OUT' then 'CLOCKED_OUT'
  end)::attendance_record_status;

  update attendance_records set status = v_new_status where id = v_record.id;

  return v_event;
end;
$$;

revoke execute on function record_attendance_event(attendance_event_type, double precision, double precision, double precision, text, text) from public;
revoke execute on function record_attendance_event(attendance_event_type, double precision, double precision, double precision, text, text) from anon;
grant execute on function record_attendance_event(attendance_event_type, double precision, double precision, double precision, text, text) to authenticated;

-- =========================================================================
-- RPC: manager_adjust_attendance — the sole path for correcting a record
-- (e.g. a forgotten clock-out). Requires a reason and always logs to
-- attendance_adjustments before changing anything.
-- =========================================================================
create or replace function manager_adjust_attendance(
  p_record_id uuid,
  p_new_status attendance_record_status,
  p_reason text
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role;
  v_branch uuid;
  v_record attendance_records%rowtype;
begin
  select role, branch_id into v_role, v_branch from profiles where id = auth.uid() and is_active;
  if v_role is null or v_role <> 'manager' then
    raise exception 'Only a manager can adjust attendance records';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A reason is required for every adjustment';
  end if;

  select * into v_record from attendance_records where id = p_record_id and branch_id = v_branch for update;
  if not found then
    raise exception 'Attendance record not found';
  end if;

  insert into attendance_adjustments (attendance_record_id, performed_by, reason, previous_status, new_status)
  values (p_record_id, auth.uid(), p_reason, v_record.status, p_new_status);

  update attendance_records set status = p_new_status where id = p_record_id;
end;
$$;

revoke execute on function manager_adjust_attendance(uuid, attendance_record_status, text) from public;
revoke execute on function manager_adjust_attendance(uuid, attendance_record_status, text) from anon;
grant execute on function manager_adjust_attendance(uuid, attendance_record_status, text) to authenticated;

-- =========================================================================
-- Manager-only update of the attendance policy settings on `branches`.
-- =========================================================================
drop policy if exists branches_update_manager on branches;
create policy branches_update_manager on branches for update
  using (current_profile_role() = 'manager' and id = current_profile_branch())
  with check (current_profile_role() = 'manager' and id = current_profile_branch());

-- =========================================================================
-- Storage — private bucket for attendance selfies. Path convention:
-- "<user_id>/<event_type>-<uuid>.jpg" — the first path segment is the
-- owning user's id, which both policies below key off directly.
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('attendance-selfies', 'attendance-selfies', false)
on conflict (id) do nothing;

drop policy if exists attendance_selfies_select on storage.objects;
create policy attendance_selfies_select on storage.objects for select
  using (
    bucket_id = 'attendance-selfies'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from profiles p
        where p.id::text = (storage.foldername(name))[1]
          and p.branch_id = current_profile_branch()
          and current_profile_role() in ('manager', 'owner')
      )
    )
  );

drop policy if exists attendance_selfies_insert on storage.objects;
create policy attendance_selfies_insert on storage.objects for insert
  with check (
    bucket_id = 'attendance-selfies'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
