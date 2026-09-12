-- =========================================================================
-- BUTTERFLY OPS — database schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`)
-- for a brand new project. Safe to re-run: guarded with IF NOT EXISTS /
-- CREATE OR REPLACE wherever practical.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums (controlled vocabularies — the whole point of normalizing Excel)
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('manager', 'staff', 'owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum (
    'NOT_STARTED',
    'IN_PROGRESS',
    'COMPLETED',
    'AWAITING_APPROVAL',
    'CHANGES_REQUESTED',
    'APPROVED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_decision as enum ('APPROVED', 'CHANGES_REQUESTED');
exception when duplicate_object then null; end $$;

-- Account lifecycle. `is_active` (below) stays the single boolean every
-- policy/query keys off — true only for ACTIVE — so this richer status is
-- purely additive: the UI/manager-facing distinction between "reversible"
-- (DEACTIVATED) and "permanent" (REMOVED), kept in sync with is_active by
-- the application on every write.
do $$ begin
  create type account_status as enum ('ACTIVE', 'DEACTIVATED', 'REMOVED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- BRANCHES — only Bhubaneswar today, but every table hangs off branch_id
-- so a second branch is a data row, not a redesign.
-- ---------------------------------------------------------------------
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

insert into branches (name, code)
  values ('Bhubaneswar', 'BBSR')
  on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- PROFILES — one row per auth.users row, carries role + branch
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  branch_id uuid not null references branches (id),
  full_name text not null,
  role user_role not null,
  is_active boolean not null default true,
  status account_status not null default 'ACTIVE',
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists profiles_branch_idx on profiles (branch_id);

-- ---------------------------------------------------------------------
-- CATEGORIES — seeded, but configurable (manager can add more later)
-- ---------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches (id),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);

insert into categories (branch_id, name, sort_order)
select b.id, c.name, c.sort_order
from branches b
cross join (values
  ('OPERATIONS', 1),
  ('FINANCE & ADMIN', 2),
  ('SAFETY & COMPLIANCE', 3),
  ('INFRASTRUCTURE', 4),
  ('BRANDING & MARKETING', 5),
  ('HIRING', 6),
  ('PARK DEVELOPMENT', 7),
  ('OTHER', 8)
) as c(name, sort_order)
where b.code = 'BBSR'
on conflict (branch_id, name) do nothing;

-- ---------------------------------------------------------------------
-- TASKS
-- ---------------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  display_id bigint generated always as identity,
  branch_id uuid not null references branches (id),
  title text not null check (char_length(btrim(title)) > 0),
  description text,
  category_id uuid references categories (id),
  assigned_to uuid references profiles (id),
  created_by uuid not null references profiles (id),
  due_date date,
  priority task_priority not null default 'MEDIUM',
  status task_status not null default 'NOT_STARTED',
  requires_evidence boolean not null default false,
  manager_remarks text,
  staff_remarks text,
  owner_remarks text,
  legacy_excel_id text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  submitted_for_approval_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references profiles (id)
);

create index if not exists tasks_branch_idx on tasks (branch_id);
create index if not exists tasks_assigned_idx on tasks (assigned_to);
create index if not exists tasks_status_idx on tasks (status);
create index if not exists tasks_due_idx on tasks (due_date);

create or replace function set_updated_at()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- TASK_UPDATES — append-only history. Never overwrite, only insert.
-- ---------------------------------------------------------------------
create table if not exists task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  actor_id uuid references profiles (id),
  action text not null,
  field text,
  old_value text,
  new_value text,
  remark text,
  created_at timestamptz not null default now()
);

create index if not exists task_updates_task_idx on task_updates (task_id, created_at);

-- ---------------------------------------------------------------------
-- EVIDENCE — pointers to files in the private "evidence" storage bucket
-- ---------------------------------------------------------------------
create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  uploaded_by uuid references profiles (id),
  file_path text not null,
  file_name text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists evidence_task_idx on evidence (task_id);

-- ---------------------------------------------------------------------
-- APPROVALS — one row per owner decision
-- ---------------------------------------------------------------------
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  decided_by uuid not null references profiles (id),
  decision approval_decision not null,
  remark text,
  created_at timestamptz not null default now()
);

create index if not exists approvals_task_idx on approvals (task_id);

-- Covering indexes for the remaining foreign keys (Postgres doesn't add
-- these automatically, and the query planner wants them).
create index if not exists approvals_decided_by_idx on approvals (decided_by);
create index if not exists evidence_uploaded_by_idx on evidence (uploaded_by);
create index if not exists task_updates_actor_idx on task_updates (actor_id);
create index if not exists tasks_approved_by_idx on tasks (approved_by);
create index if not exists tasks_category_idx on tasks (category_id);
create index if not exists tasks_created_by_idx on tasks (created_by);

-- =========================================================================
-- HELPER FUNCTIONS (used inside RLS policies)
--
-- The `and is_active` guard is the single choke point that revokes ALL
-- row-level access the instant an account is deactivated or removed: a
-- role check like `current_profile_role() = 'manager'` becomes
-- `NULL = 'manager'` → NULL → denied, and a branch check like
-- `branch_id = current_profile_branch()` becomes `branch_id = NULL` →
-- denied — regardless of whether a JWT/session they already hold is
-- still cryptographically valid.
-- =========================================================================
create or replace function current_profile_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active;
$$;

create or replace function current_profile_branch()
returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from profiles where id = auth.uid() and is_active;
$$;

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================
alter table branches enable row level security;
alter table profiles enable row level security;
alter table categories enable row level security;
alter table tasks enable row level security;
alter table task_updates enable row level security;
alter table evidence enable row level security;
alter table approvals enable row level security;

-- BRANCHES: any signed-in user may read their own branch row
drop policy if exists branches_select on branches;
create policy branches_select on branches for select
  using (id = current_profile_branch());

-- PROFILES: everyone in the branch can read names (needed for assignee
-- display); only the manager can change roles/status; profile *creation*
-- happens server-side with the service role (Supabase Admin API), which
-- bypasses RLS entirely, so no insert policy is needed for normal users.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (branch_id = current_profile_branch());

drop policy if exists profiles_update_manager on profiles;
create policy profiles_update_manager on profiles for update
  using (current_profile_role() = 'manager' and branch_id = current_profile_branch());

-- CATEGORIES: everyone reads; only manager writes
drop policy if exists categories_select on categories;
create policy categories_select on categories for select
  using (branch_id = current_profile_branch());

-- Split into insert/update/delete (rather than "for all") so this doesn't
-- also run as a second, redundant permissive policy on every SELECT.
drop policy if exists categories_write_manager on categories;
drop policy if exists categories_insert_manager on categories;
create policy categories_insert_manager on categories for insert
  with check (current_profile_role() = 'manager' and branch_id = current_profile_branch());

drop policy if exists categories_update_manager on categories;
create policy categories_update_manager on categories for update
  using (current_profile_role() = 'manager' and branch_id = current_profile_branch())
  with check (current_profile_role() = 'manager' and branch_id = current_profile_branch());

drop policy if exists categories_delete_manager on categories;
create policy categories_delete_manager on categories for delete
  using (current_profile_role() = 'manager' and branch_id = current_profile_branch());

-- TASKS
-- Manager + Owner: see every task in the branch. Staff: only their own.
-- auth.uid() is wrapped in a `select` below so Postgres evaluates it once
-- per statement instead of once per row (see Supabase's RLS performance
-- guide) — functionally identical to a bare auth.uid().
drop policy if exists tasks_select on tasks;
create policy tasks_select on tasks for select
  using (
    branch_id = current_profile_branch()
    and (
      current_profile_role() in ('manager', 'owner')
      or assigned_to = (select auth.uid())
    )
  );

-- Only the manager creates tasks directly.
drop policy if exists tasks_insert_manager on tasks;
create policy tasks_insert_manager on tasks for insert
  with check (current_profile_role() = 'manager' and branch_id = current_profile_branch());

-- Only the manager updates tasks directly (full operational control).
-- Staff and owners change tasks exclusively through the SECURITY DEFINER
-- RPCs below, which enforce exactly which fields/transitions they may
-- touch — this is stronger than trying to do column-level RLS.
drop policy if exists tasks_update_manager on tasks;
create policy tasks_update_manager on tasks for update
  using (current_profile_role() = 'manager' and branch_id = current_profile_branch())
  with check (current_profile_role() = 'manager' and branch_id = current_profile_branch());

drop policy if exists tasks_delete_manager on tasks;
create policy tasks_delete_manager on tasks for delete
  using (current_profile_role() = 'manager' and branch_id = current_profile_branch());

-- TASK_UPDATES: readable by anyone who can read the parent task; written
-- only through RPCs / manager actions (insert policy mirrors select).
drop policy if exists task_updates_select on task_updates;
create policy task_updates_select on task_updates for select
  using (
    exists (
      select 1 from tasks t
      where t.id = task_updates.task_id
        and t.branch_id = current_profile_branch()
        and (current_profile_role() in ('manager', 'owner') or t.assigned_to = (select auth.uid()))
    )
  );

drop policy if exists task_updates_insert on task_updates;
create policy task_updates_insert on task_updates for insert
  with check (
    exists (
      select 1 from tasks t
      where t.id = task_updates.task_id
        and t.branch_id = current_profile_branch()
        and current_profile_role() = 'manager'
    )
  );

-- EVIDENCE: manager/owner see all in-branch evidence; staff see only
-- evidence on their assigned tasks. Insert allowed for manager or the
-- assigned staff member.
drop policy if exists evidence_select on evidence;
create policy evidence_select on evidence for select
  using (
    exists (
      select 1 from tasks t
      where t.id = evidence.task_id
        and t.branch_id = current_profile_branch()
        and (current_profile_role() in ('manager', 'owner') or t.assigned_to = (select auth.uid()))
    )
  );

drop policy if exists evidence_insert on evidence;
create policy evidence_insert on evidence for insert
  with check (
    exists (
      select 1 from tasks t
      where t.id = evidence.task_id
        and t.branch_id = current_profile_branch()
        and (current_profile_role() = 'manager' or t.assigned_to = (select auth.uid()))
    )
  );

-- APPROVALS: readable by manager/owner; written only via the owner_decide
-- RPC below (security definer), so no direct insert policy for clients.
drop policy if exists approvals_select on approvals;
create policy approvals_select on approvals for select
  using (
    exists (
      select 1 from tasks t
      where t.id = approvals.task_id
        and t.branch_id = current_profile_branch()
        and current_profile_role() in ('manager', 'owner')
    )
  );

-- =========================================================================
-- RPC FUNCTIONS — the only way staff/owners mutate tasks. Each one checks
-- role + ownership itself, so permissions are enforced in the database,
-- not just hidden in the UI.
-- =========================================================================

-- STAFF: move an assigned task between NOT_STARTED -> IN_PROGRESS -> COMPLETED.
create or replace function staff_update_task_status(
  p_task_id uuid,
  p_new_status task_status,
  p_remark text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_task tasks%rowtype;
  v_role user_role;
begin
  select role into v_role from profiles where id = auth.uid() and is_active;
  if v_role is null then
    raise exception 'Your account no longer has access to Butterfly Ops';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.assigned_to is distinct from auth.uid() then
    raise exception 'You can only update tasks assigned to you';
  end if;

  if p_new_status not in ('IN_PROGRESS', 'COMPLETED') then
    raise exception 'Staff may only move a task to IN_PROGRESS or COMPLETED';
  end if;

  if p_new_status = 'IN_PROGRESS' and v_task.status not in ('NOT_STARTED', 'CHANGES_REQUESTED') then
    raise exception 'Task cannot be started from its current status';
  end if;

  if p_new_status = 'COMPLETED' and v_task.status <> 'IN_PROGRESS' then
    raise exception 'Task must be in progress before it can be marked completed';
  end if;

  update tasks set
    status = p_new_status,
    staff_remarks = coalesce(p_remark, staff_remarks),
    completed_at = case when p_new_status = 'COMPLETED' then now() else completed_at end
  where id = p_task_id;

  insert into task_updates (task_id, actor_id, action, field, old_value, new_value, remark)
  values (p_task_id, auth.uid(), 'status_changed', 'status', v_task.status::text, p_new_status::text, p_remark);
end;
$$;

-- STAFF (or manager): add a remark without changing status.
create or replace function add_staff_remark(
  p_task_id uuid,
  p_remark text
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_task tasks%rowtype;
  v_role user_role;
begin
  select role into v_role from profiles where id = auth.uid() and is_active;
  if v_role is null then
    raise exception 'Your account no longer has access to Butterfly Ops';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if v_role = 'staff' and v_task.assigned_to is distinct from auth.uid() then
    raise exception 'You can only comment on tasks assigned to you';
  elsif v_role not in ('staff', 'manager') then
    raise exception 'Not authorized';
  end if;

  update tasks set staff_remarks = p_remark where id = p_task_id;

  insert into task_updates (task_id, actor_id, action, field, new_value, remark)
  values (p_task_id, auth.uid(), 'remark_added', 'staff_remarks', p_remark, p_remark);
end;
$$;

-- OWNER: approve or request changes on a task awaiting approval.
create or replace function owner_decide_task(
  p_task_id uuid,
  p_decision approval_decision,
  p_remark text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_task tasks%rowtype;
  v_role user_role;
begin
  select role into v_role from profiles where id = auth.uid() and is_active;
  if v_role is null or v_role <> 'owner' then
    raise exception 'Only an owner can decide on approvals';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.status <> 'AWAITING_APPROVAL' then
    raise exception 'Task is not awaiting approval';
  end if;

  -- The CASE result is cast explicitly: a bare CASE over string literals
  -- resolves to `text`, and Postgres won't implicitly assignment-cast
  -- `text` to a user-defined enum the way it does for a single literal.
  update tasks set
    status = (case when p_decision = 'APPROVED' then 'APPROVED' else 'CHANGES_REQUESTED' end)::task_status,
    owner_remarks = p_remark,
    approved_at = case when p_decision = 'APPROVED' then now() else approved_at end,
    approved_by = case when p_decision = 'APPROVED' then auth.uid() else approved_by end
  where id = p_task_id;

  insert into approvals (task_id, decided_by, decision, remark)
  values (p_task_id, auth.uid(), p_decision, p_remark);

  insert into task_updates (task_id, actor_id, action, field, old_value, new_value, remark)
  values (
    p_task_id, auth.uid(),
    case when p_decision = 'APPROVED' then 'approved' else 'changes_requested' end,
    'status', 'AWAITING_APPROVAL', p_decision::text, p_remark
  );
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on function creation, which
-- would let the anonymous (signed-out) API role call these side-effecting
-- RPCs directly. Revoke that first, then grant only to authenticated.
revoke execute on function staff_update_task_status(uuid, task_status, text) from public;
revoke execute on function add_staff_remark(uuid, text) from public;
revoke execute on function owner_decide_task(uuid, approval_decision, text) from public;

-- Any signed-in user may rename themselves — but nothing else about their
-- profile (role, branch, active flag stay manager-controlled). A narrow RPC
-- like this is safer than a general "users can update their own row" RLS
-- policy, which would also let a client update its own role/branch/is_active
-- since RLS operates on rows, not columns.
create or replace function update_own_full_name(p_full_name text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if btrim(p_full_name) = '' then
    raise exception 'Name cannot be empty';
  end if;
  update profiles set full_name = btrim(p_full_name) where id = auth.uid();
end;
$$;

revoke execute on function update_own_full_name(text) from public;
revoke execute on function update_own_full_name(text) from anon;
grant execute on function update_own_full_name(text) to authenticated;

grant execute on function staff_update_task_status(uuid, task_status, text) to authenticated;
grant execute on function add_staff_remark(uuid, text) to authenticated;
grant execute on function owner_decide_task(uuid, approval_decision, text) to authenticated;
