import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceAdjustment, AttendanceEvent, AttendanceRecord, Branch, Category, Evidence, Profile, Task, TaskUpdate } from "@/lib/types";
import { todayInParkTZ } from "@/lib/attendance";

const TASK_SELECT = `
  *,
  category:categories(id, branch_id, name, sort_order, is_active),
  assignee:profiles!tasks_assigned_to_fkey(id, branch_id, full_name, role, is_active, status),
  creator:profiles!tasks_created_by_fkey(id, branch_id, full_name, role, is_active)
`;

export async function getCategories(branchId: string): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export async function getStaff(branchId: string): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("branch_id", branchId)
    .eq("role", "staff")
    .eq("is_active", true)
    .order("full_name");
  return data ?? [];
}

export async function getAllTeam(branchId: string): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("branch_id", branchId).order("full_name");
  return data ?? [];
}

export interface TaskFilters {
  status?: string;
  categoryId?: string;
  assignedTo?: string;
  priority?: string;
  search?: string;
  dueBucket?: "today" | "week" | "overdue";
  onlyMine?: string; // profile id
  includeArchived?: boolean;
}

export async function getTasks(branchId: string, filters: TaskFilters = {}): Promise<Task[]> {
  const supabase = await createClient();
  let query = supabase.from("tasks").select(TASK_SELECT).eq("branch_id", branchId);

  if (!filters.includeArchived) query = query.eq("is_archived", false);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.onlyMine) query = query.eq("assigned_to", filters.onlyMine);
  if (filters.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }

  const today = new Date().toISOString().slice(0, 10);
  if (filters.dueBucket === "today") query = query.eq("due_date", today);
  if (filters.dueBucket === "overdue") {
    query = query
      .lt("due_date", today)
      .not("status", "in", "(COMPLETED,AWAITING_APPROVAL,APPROVED)");
  }
  if (filters.dueBucket === "week") {
    const weekOut = new Date();
    weekOut.setDate(weekOut.getDate() + 7);
    query = query.gte("due_date", today).lte("due_date", weekOut.toISOString().slice(0, 10));
  }

  const { data } = await query.order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  return (data as unknown as Task[]) ?? [];
}

export async function getTask(taskId: string): Promise<Task | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select(TASK_SELECT).eq("id", taskId).maybeSingle();
  return (data as unknown as Task) ?? null;
}

export async function getTaskUpdates(taskId: string): Promise<TaskUpdate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_updates")
    .select("*, actor:profiles(id, branch_id, full_name, role, is_active)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  return (data as unknown as TaskUpdate[]) ?? [];
}

export async function getEvidence(taskId: string): Promise<Evidence[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("evidence").select("*").eq("task_id", taskId).order("created_at");
  const rows = (data as Evidence[]) ?? [];

  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage.from("evidence").createSignedUrl(row.file_path, 3600);
      return { ...row, url: signed?.signedUrl };
    })
  );
  return withUrls;
}

export interface DashboardMetrics {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  awaitingApproval: number;
}

export function computeMetrics(tasks: Task[]): DashboardMetrics {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let completed = 0,
    inProgress = 0,
    notStarted = 0,
    overdue = 0,
    awaitingApproval = 0;

  for (const t of tasks) {
    if (t.status === "COMPLETED" || t.status === "APPROVED") completed++;
    if (t.status === "IN_PROGRESS") inProgress++;
    if (t.status === "NOT_STARTED" || t.status === "CHANGES_REQUESTED") notStarted++;
    if (t.status === "AWAITING_APPROVAL") awaitingApproval++;
    if (t.due_date && new Date(t.due_date) < today && !["COMPLETED", "AWAITING_APPROVAL", "APPROVED"].includes(t.status)) {
      overdue++;
    }
  }

  return { total: tasks.length, completed, inProgress, notStarted, overdue, awaitingApproval };
}

export async function getRecentActivity(branchId: string, limit = 8): Promise<TaskUpdate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_updates")
    .select("*, actor:profiles(id, branch_id, full_name, role, is_active), task:tasks!inner(id, title, branch_id)")
    .eq("task.branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as unknown as (TaskUpdate & { task: { id: string; title: string } })[]) ?? [];
}

// =========================================================================
// Attendance & Staff Presence
// =========================================================================

export async function getBranch(branchId: string): Promise<Branch | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("branches").select("*").eq("id", branchId).maybeSingle();
  return data ?? null;
}

/** Every attendance record for one calendar day (defaults to today, park
 * timezone) across the branch — the manager/owner overview list. */
export async function getAttendanceForDate(branchId: string, date?: string): Promise<AttendanceRecord[]> {
  const supabase = await createClient();
  const day = date ?? todayInParkTZ();

  const { data: records } = await supabase
    .from("attendance_records")
    .select("*, user:profiles(id, branch_id, full_name, role, is_active, status)")
    .eq("branch_id", branchId)
    .eq("attendance_date", day)
    .order("created_at");

  const rows = (records as unknown as AttendanceRecord[]) ?? [];
  if (rows.length === 0) return [];

  const { data: events } = await supabase
    .from("attendance_events")
    .select("*")
    .in(
      "attendance_record_id",
      rows.map((r) => r.id)
    )
    .order("event_timestamp");

  const byRecord = new Map<string, AttendanceEvent[]>();
  for (const e of (events as unknown as AttendanceEvent[]) ?? []) {
    const list = byRecord.get(e.attendance_record_id) ?? [];
    list.push(e);
    byRecord.set(e.attendance_record_id, list);
  }

  return rows.map((r) => ({ ...r, events: byRecord.get(r.id) ?? [] }));
}

/** All ACTIVE staff for the branch, each paired with today's attendance
 * record (or none, if they haven't clocked in) — this is what lets the
 * overview show "Not clocked in" as its own bucket rather than just
 * omitting people with no row yet. */
export async function getStaffAttendanceOverview(branchId: string, date?: string): Promise<AttendanceRecord[]> {
  const [staff, records] = await Promise.all([getStaff(branchId), getAttendanceForDate(branchId, date)]);
  const byUser = new Map(records.map((r) => [r.user_id, r]));
  const day = date ?? todayInParkTZ();

  return staff.map((member) => {
    const existing = byUser.get(member.id);
    if (existing) return existing;
    return {
      id: `placeholder-${member.id}`,
      branch_id: branchId,
      user_id: member.id,
      attendance_date: day,
      status: "NOT_STARTED",
      expected_shift_minutes: 0,
      lunch_allowed_minutes: 0,
      created_at: day,
      updated_at: day,
      user: member,
      events: [],
    };
  });
}

export async function getMyAttendanceToday(userId: string): Promise<AttendanceRecord | null> {
  const supabase = await createClient();
  const day = todayInParkTZ();
  const { data: record } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", userId)
    .eq("attendance_date", day)
    .maybeSingle();

  if (!record) return null;

  const { data: events } = await supabase
    .from("attendance_events")
    .select("*")
    .eq("attendance_record_id", record.id)
    .order("event_timestamp");

  return { ...(record as AttendanceRecord), events: (events as unknown as AttendanceEvent[]) ?? [] };
}

export async function getMyAttendanceHistory(userId: string, limit = 30): Promise<AttendanceRecord[]> {
  const supabase = await createClient();
  const { data: records } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", userId)
    .order("attendance_date", { ascending: false })
    .limit(limit);

  const rows = (records as AttendanceRecord[]) ?? [];
  if (rows.length === 0) return [];

  const { data: events } = await supabase
    .from("attendance_events")
    .select("*")
    .in(
      "attendance_record_id",
      rows.map((r) => r.id)
    )
    .order("event_timestamp");

  const byRecord = new Map<string, AttendanceEvent[]>();
  for (const e of (events as unknown as AttendanceEvent[]) ?? []) {
    const list = byRecord.get(e.attendance_record_id) ?? [];
    list.push(e);
    byRecord.set(e.attendance_record_id, list);
  }

  return rows.map((r) => ({ ...r, events: byRecord.get(r.id) ?? [] }));
}

export async function getAttendanceRecord(recordId: string): Promise<AttendanceRecord | null> {
  const supabase = await createClient();
  const { data: record } = await supabase
    .from("attendance_records")
    .select("*, user:profiles(id, branch_id, full_name, role, is_active, status)")
    .eq("id", recordId)
    .maybeSingle();
  if (!record) return null;

  const { data: events } = await supabase
    .from("attendance_events")
    .select("*")
    .eq("attendance_record_id", recordId)
    .order("event_timestamp");

  const rows = (events as unknown as AttendanceEvent[]) ?? [];

  // Signed URLs for selfies — private bucket, short-lived link, same
  // pattern as task evidence.
  const withUrls = await Promise.all(
    rows.map(async (e) => {
      if (!e.evidence_image_path) return e;
      const { data: signed } = await supabase.storage.from("attendance-selfies").createSignedUrl(e.evidence_image_path, 3600);
      return { ...e, evidence_image_url: signed?.signedUrl };
    })
  );

  return { ...(record as unknown as AttendanceRecord), events: withUrls };
}

export async function getAttendanceAdjustments(recordId: string): Promise<AttendanceAdjustment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_adjustments")
    .select("*, performer:profiles(id, branch_id, full_name, role, is_active, status)")
    .eq("attendance_record_id", recordId)
    .order("created_at", { ascending: false });
  return (data as unknown as AttendanceAdjustment[]) ?? [];
}
