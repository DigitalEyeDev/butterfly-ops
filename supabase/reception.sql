-- =========================================================================
-- BUTTERFLY OPS — Reception Operations module
-- Run AFTER schema.sql and departments.sql, once, in the Supabase SQL
-- editor. Safe to re-run.
--
-- Design summary:
--  - One report per BRANCH per calendar day (business_date), not per
--    receptionist — the front desk reports one set of park-wide numbers
--    per day regardless of who's on the desk. A second receptionist who
--    opens Reception mid-day sees/continues the same report.
--  - Clients never write to reception_reports/reception_report_updates
--    directly (no insert/update policy for any role) — every write goes
--    through the RPCs below, which re-derive the caller's identity/role/
--    branch themselves, same rigor as record_attendance_event.
--  - The business date is never client-supplied — save_reception_draft
--    derives "today" from the server clock (Asia/Kolkata), exactly like
--    attendance's record_attendance_event, so a receptionist's device
--    clock can never backdate or duplicate a report.
--  - A typed review count alone is not accepted as proof: submitting a
--    report with review_count > 0 requires at least one evidence file.
-- =========================================================================

do $$ begin
  create type reception_report_status as enum ('DRAFT', 'SUBMITTED', 'CORRECTION_REQUESTED', 'VERIFIED');
exception when duplicate_object then null; end $$;

create table if not exists reception_reports (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches (id),
  business_date date not null,
  status reception_report_status not null default 'DRAFT',
  visitors_count int check (visitors_count is null or visitors_count >= 0),
  tickets_sold int check (tickets_sold is null or tickets_sold >= 0),
  socks_sold int check (socks_sold is null or socks_sold >= 0),
  review_count int check (review_count is null or review_count >= 0),
  remarks text,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_by uuid references profiles (id),
  submitted_at timestamptz,
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  correction_reason text,
  unique (branch_id, business_date)
);

create index if not exists reception_reports_branch_date_idx on reception_reports (branch_id, business_date);
create index if not exists reception_reports_created_by_idx on reception_reports (created_by);
create index if not exists reception_reports_submitted_by_idx on reception_reports (submitted_by);
create index if not exists reception_reports_reviewed_by_idx on reception_reports (reviewed_by);

drop trigger if exists reception_reports_set_updated_at on reception_reports;
create trigger reception_reports_set_updated_at
  before update on reception_reports
  for each row execute function set_updated_at();

-- Append-only history — mirrors task_updates. Never edited, only inserted.
create table if not exists reception_report_updates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reception_reports (id) on delete cascade,
  actor_id uuid references profiles (id),
  action text not null,
  field text,
  old_value text,
  new_value text,
  remark text,
  created_at timestamptz not null default now()
);

create index if not exists reception_report_updates_report_idx on reception_report_updates (report_id, created_at);
create index if not exists reception_report_updates_actor_idx on reception_report_updates (actor_id);

-- Review-count evidence — mirrors the task `evidence` table.
create table if not exists reception_review_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reception_reports (id) on delete cascade,
  uploaded_by uuid references profiles (id),
  file_path text not null,
  file_name text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists reception_review_evidence_report_idx on reception_review_evidence (report_id);
create index if not exists reception_review_evidence_uploaded_by_idx on reception_review_evidence (uploaded_by);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table reception_reports enable row level security;
alter table reception_report_updates enable row level security;
alter table reception_review_evidence enable row level security;

drop policy if exists reception_reports_select on reception_reports;
create policy reception_reports_select on reception_reports for select
  using (
    branch_id = current_profile_branch()
    and current_profile_role() in ('manager', 'owner', 'receptionist')
  );

drop policy if exists reception_report_updates_select on reception_report_updates;
create policy reception_report_updates_select on reception_report_updates for select
  using (
    exists (
      select 1 from reception_reports r
      where r.id = reception_report_updates.report_id
        and r.branch_id = current_profile_branch()
        and current_profile_role() in ('manager', 'owner', 'receptionist')
    )
  );

drop policy if exists reception_review_evidence_select on reception_review_evidence;
create policy reception_review_evidence_select on reception_review_evidence for select
  using (
    exists (
      select 1 from reception_reports r
      where r.id = reception_review_evidence.report_id
        and r.branch_id = current_profile_branch()
        and current_profile_role() in ('manager', 'owner', 'receptionist')
    )
  );

-- Insert/delete need no server-derived data beyond auth.uid(), so (like
-- task evidence and attendance selfies) these are plain scoped RLS
-- policies rather than RPCs — the receptionist may only attach/remove
-- evidence on an in-branch report that's still editable.
drop policy if exists reception_review_evidence_insert on reception_review_evidence;
create policy reception_review_evidence_insert on reception_review_evidence for insert
  with check (
    current_profile_role() = 'receptionist'
    and exists (
      select 1 from reception_reports r
      where r.id = reception_review_evidence.report_id
        and r.branch_id = current_profile_branch()
        and r.status in ('DRAFT', 'CORRECTION_REQUESTED')
    )
  );

drop policy if exists reception_review_evidence_delete on reception_review_evidence;
create policy reception_review_evidence_delete on reception_review_evidence for delete
  using (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from reception_reports r
      where r.id = reception_review_evidence.report_id
        and r.status in ('DRAFT', 'CORRECTION_REQUESTED')
    )
  );

-- =========================================================================
-- RPCs — the only way a reception report is ever written.
-- =========================================================================

-- RECEPTIONIST: create today's draft, or update it while still editable.
-- Values may be partial (a draft doesn't need every field yet).
create or replace function save_reception_draft(
  p_visitors int default null,
  p_tickets int default null,
  p_socks int default null,
  p_reviews int default null,
  p_remarks text default null
)
returns reception_reports
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role;
  v_branch_id uuid;
  v_today date;
  v_record reception_reports%rowtype;
begin
  select role, branch_id into v_role, v_branch_id from profiles where id = auth.uid() and is_active;
  if v_role is null or v_role <> 'receptionist' then
    raise exception 'Only a receptionist can file this report';
  end if;

  if p_visitors is not null and p_visitors < 0 then
    raise exception 'Visitors cannot be negative';
  end if;
  if p_tickets is not null and p_tickets < 0 then
    raise exception 'Tickets sold cannot be negative';
  end if;
  if p_socks is not null and p_socks < 0 then
    raise exception 'Socks sold cannot be negative';
  end if;
  if p_reviews is not null and p_reviews < 0 then
    raise exception 'Review count cannot be negative';
  end if;

  v_today := (now() at time zone 'Asia/Kolkata')::date;

  select * into v_record from reception_reports
    where branch_id = v_branch_id and business_date = v_today
    for update;

  if found and v_record.status not in ('DRAFT', 'CORRECTION_REQUESTED') then
    raise exception 'This report has already been submitted and can no longer be edited as a draft';
  end if;

  if not found then
    insert into reception_reports (
      branch_id, business_date, status, visitors_count, tickets_sold, socks_sold, review_count, remarks, created_by
    ) values (
      v_branch_id, v_today, 'DRAFT', p_visitors, p_tickets, p_socks, p_reviews, nullif(btrim(coalesce(p_remarks, '')), ''), auth.uid()
    ) returning * into v_record;

    insert into reception_report_updates (report_id, actor_id, action, remark)
    values (v_record.id, auth.uid(), 'draft_created', null);
  else
    update reception_reports set
      visitors_count = p_visitors,
      tickets_sold = p_tickets,
      socks_sold = p_socks,
      review_count = p_reviews,
      remarks = nullif(btrim(coalesce(p_remarks, '')), '')
    where id = v_record.id
    returning * into v_record;

    insert into reception_report_updates (report_id, actor_id, action, remark)
    values (v_record.id, auth.uid(), 'draft_saved', null);
  end if;

  return v_record;
end;
$$;

-- RECEPTIONIST: submit a draft/correction. Requires all four numbers and,
-- when reviews are reported, at least one evidence file.
create or replace function submit_reception_report(p_report_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role;
  v_branch_id uuid;
  v_record reception_reports%rowtype;
  v_evidence_count int;
begin
  select role, branch_id into v_role, v_branch_id from profiles where id = auth.uid() and is_active;
  if v_role is null or v_role <> 'receptionist' then
    raise exception 'Only a receptionist can submit this report';
  end if;

  select * into v_record from reception_reports
    where id = p_report_id and branch_id = v_branch_id for update;
  if not found then
    raise exception 'Report not found';
  end if;

  if v_record.status not in ('DRAFT', 'CORRECTION_REQUESTED') then
    raise exception 'This report has already been submitted';
  end if;

  if v_record.visitors_count is null or v_record.tickets_sold is null
     or v_record.socks_sold is null or v_record.review_count is null then
    raise exception 'Fill in visitors, tickets sold, socks sold, and reviews before submitting';
  end if;

  if v_record.review_count > 0 then
    select count(*) into v_evidence_count from reception_review_evidence where report_id = v_record.id;
    if v_evidence_count = 0 then
      raise exception 'Please attach evidence for the reported reviews before submitting';
    end if;
  end if;

  update reception_reports set
    status = 'SUBMITTED',
    submitted_by = auth.uid(),
    submitted_at = now()
  where id = p_report_id;

  insert into reception_report_updates (report_id, actor_id, action, old_value, new_value)
  values (p_report_id, auth.uid(), 'submitted', v_record.status::text, 'SUBMITTED');
end;
$$;

-- MANAGER: verify a submitted report.
create or replace function manager_verify_reception_report(
  p_report_id uuid,
  p_remark text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role;
  v_branch_id uuid;
  v_record reception_reports%rowtype;
begin
  select role, branch_id into v_role, v_branch_id from profiles where id = auth.uid() and is_active;
  if v_role is null or v_role <> 'manager' then
    raise exception 'Only a manager can verify this report';
  end if;

  select * into v_record from reception_reports
    where id = p_report_id and branch_id = v_branch_id for update;
  if not found then
    raise exception 'Report not found';
  end if;
  if v_record.status <> 'SUBMITTED' then
    raise exception 'Only a submitted report can be verified';
  end if;

  update reception_reports set
    status = 'VERIFIED',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_report_id;

  insert into reception_report_updates (report_id, actor_id, action, old_value, new_value, remark)
  values (p_report_id, auth.uid(), 'verified', 'SUBMITTED', 'VERIFIED', p_remark);
end;
$$;

-- MANAGER: send a submitted report back for correction, with a reason.
create or replace function manager_request_reception_correction(
  p_report_id uuid,
  p_reason text
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role;
  v_branch_id uuid;
  v_record reception_reports%rowtype;
begin
  select role, branch_id into v_role, v_branch_id from profiles where id = auth.uid() and is_active;
  if v_role is null or v_role <> 'manager' then
    raise exception 'Only a manager can request a correction';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Explain what needs to be corrected';
  end if;

  select * into v_record from reception_reports
    where id = p_report_id and branch_id = v_branch_id for update;
  if not found then
    raise exception 'Report not found';
  end if;
  if v_record.status <> 'SUBMITTED' then
    raise exception 'Only a submitted report can have a correction requested';
  end if;

  update reception_reports set
    status = 'CORRECTION_REQUESTED',
    correction_reason = p_reason,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_report_id;

  insert into reception_report_updates (report_id, actor_id, action, old_value, new_value, remark)
  values (p_report_id, auth.uid(), 'correction_requested', 'SUBMITTED', 'CORRECTION_REQUESTED', p_reason);
end;
$$;

revoke execute on function save_reception_draft(int, int, int, int, text) from public;
revoke execute on function save_reception_draft(int, int, int, int, text) from anon;
grant execute on function save_reception_draft(int, int, int, int, text) to authenticated;

revoke execute on function submit_reception_report(uuid) from public;
revoke execute on function submit_reception_report(uuid) from anon;
grant execute on function submit_reception_report(uuid) to authenticated;

revoke execute on function manager_verify_reception_report(uuid, text) from public;
revoke execute on function manager_verify_reception_report(uuid, text) from anon;
grant execute on function manager_verify_reception_report(uuid, text) to authenticated;

revoke execute on function manager_request_reception_correction(uuid, text) from public;
revoke execute on function manager_request_reception_correction(uuid, text) from anon;
grant execute on function manager_request_reception_correction(uuid, text) to authenticated;

-- =========================================================================
-- Storage — private bucket for review evidence (screenshots). Path
-- convention: "<report_id>/<uuid>-<filename>" — mirrors the "evidence"
-- bucket used for task proof.
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('reception-evidence', 'reception-evidence', false)
on conflict (id) do nothing;

drop policy if exists reception_evidence_storage_select on storage.objects;
create policy reception_evidence_storage_select on storage.objects for select
  using (
    bucket_id = 'reception-evidence'
    and exists (
      select 1 from reception_reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.branch_id = current_profile_branch()
        and current_profile_role() in ('manager', 'owner', 'receptionist')
    )
  );

drop policy if exists reception_evidence_storage_insert on storage.objects;
create policy reception_evidence_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'reception-evidence'
    and current_profile_role() = 'receptionist'
    and exists (
      select 1 from reception_reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.branch_id = current_profile_branch()
        and r.status in ('DRAFT', 'CORRECTION_REQUESTED')
    )
  );

drop policy if exists reception_evidence_storage_delete on storage.objects;
create policy reception_evidence_storage_delete on storage.objects for delete
  using (
    bucket_id = 'reception-evidence'
    and exists (
      select 1 from reception_reports r
      where r.id::text = (storage.foldername(name))[1]
        and r.branch_id = current_profile_branch()
        and r.status in ('DRAFT', 'CORRECTION_REQUESTED')
    )
    and exists (
      select 1 from reception_review_evidence e
      where e.file_path = name and e.uploaded_by = (select auth.uid())
    )
  );
