-- =========================================================================
-- BUTTERFLY OPS — storage bucket for task evidence (photos/screenshots/docs)
-- Run AFTER schema.sql, once, in the Supabase SQL editor.
-- Files are stored at path "<task_id>/<uuid>-<filename>" inside a PRIVATE
-- bucket; access is gated by the same task-visibility rules as the
-- `evidence` table so a staff member can never read another task's files.
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

drop policy if exists evidence_storage_select on storage.objects;
create policy evidence_storage_select on storage.objects for select
  using (
    bucket_id = 'evidence'
    and exists (
      select 1 from tasks t
      where t.id::text = (storage.foldername(name))[1]
        and t.branch_id = current_profile_branch()
        and (current_profile_role() in ('manager', 'owner') or t.assigned_to = auth.uid())
    )
  );

drop policy if exists evidence_storage_insert on storage.objects;
create policy evidence_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'evidence'
    and exists (
      select 1 from tasks t
      where t.id::text = (storage.foldername(name))[1]
        and t.branch_id = current_profile_branch()
        and (current_profile_role() = 'manager' or t.assigned_to = auth.uid())
    )
  );

drop policy if exists evidence_storage_delete on storage.objects;
create policy evidence_storage_delete on storage.objects for delete
  using (
    bucket_id = 'evidence'
    and exists (
      select 1 from tasks t
      where t.id::text = (storage.foldername(name))[1]
        and t.branch_id = current_profile_branch()
        and current_profile_role() = 'manager'
    )
  );
