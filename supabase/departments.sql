-- =========================================================================
-- BUTTERFLY OPS — Department system
-- Run AFTER schema.sql, once, in the Supabase SQL editor. Safe to re-run.
--
-- Departments are organizational grouping ONLY — permissions stay entirely
-- on `profiles.role`. A manager (or owner) can add a department from the
-- Team UI and it becomes assignable immediately, no code/deploy needed.
-- =========================================================================
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches (id),
  name text not null check (char_length(btrim(name)) > 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);

create index if not exists departments_branch_idx on departments (branch_id);

alter table profiles add column if not exists department_id uuid references departments (id);
create index if not exists profiles_department_idx on profiles (department_id);

-- Seed a reasonable starting set for the existing branch — management can
-- add more (Electrical, etc.) from the Team UI at any time.
insert into departments (branch_id, name, description, is_active)
select b.id, d.name, d.description, true
from branches b
cross join (values
  ('Management', 'Park leadership and administration'),
  ('Reception', 'Front desk — visitors, ticketing, and daily reporting'),
  ('Park Operations', 'Day-to-day floor operations'),
  ('Trainers / Training', 'Trampoline coaching and guest safety training'),
  ('Cleaning & Housekeeping', 'Facility cleanliness and upkeep'),
  ('Accounts & Finance', 'Billing, payroll, and financial records'),
  ('Maintenance', 'Equipment and facility maintenance'),
  ('Electrical', 'Electrical systems and repairs'),
  ('Marketing', 'Promotions, social media, and outreach'),
  ('Security', 'Park security and access control'),
  ('Other', 'Anything not covered above')
) as d(name, description)
where b.code = 'BBSR'
on conflict (branch_id, name) do nothing;

alter table departments enable row level security;

-- Everyone in the branch can read (needed for the assignment dropdown);
-- only manager/owner can add or edit. No delete policy — departments are
-- deactivated (is_active), never deleted, so profiles.department_id can
-- never dangle.
drop policy if exists departments_select on departments;
create policy departments_select on departments for select
  using (branch_id = current_profile_branch());

drop policy if exists departments_insert_manager on departments;
create policy departments_insert_manager on departments for insert
  with check (current_profile_role() in ('manager', 'owner') and branch_id = current_profile_branch());

drop policy if exists departments_update_manager on departments;
create policy departments_update_manager on departments for update
  using (current_profile_role() in ('manager', 'owner') and branch_id = current_profile_branch())
  with check (current_profile_role() in ('manager', 'owner') and branch_id = current_profile_branch());
