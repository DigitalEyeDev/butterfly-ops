"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentProfile } from "@/lib/auth";
import { taskFormSchema, remarkSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/actions/auth";

function friendlyError(error: { message?: string; code?: string } | null): string {
  if (!error) return "Something went wrong. Please try again.";
  // Postgres/PostgREST errors are technical — never show them raw.
  return "Couldn't save this task. Check your connection and try again.";
}

export async function createTask(formData: FormData): Promise<ActionResult> {
  const manager = await requireRole("manager");

  const raw = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category_id: String(formData.get("category_id") ?? ""),
    assigned_to: String(formData.get("assigned_to") ?? ""),
    due_date: String(formData.get("due_date") ?? ""),
    priority: String(formData.get("priority") ?? "MEDIUM"),
    status: String(formData.get("status") ?? "NOT_STARTED"),
    requires_evidence: formData.get("requires_evidence") === "on",
    manager_remarks: String(formData.get("manager_remarks") ?? ""),
  };

  const parsed = taskFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      branch_id: manager.branch_id,
      title: v.title,
      description: v.description || null,
      category_id: v.category_id || null,
      assigned_to: v.assigned_to || null,
      created_by: manager.id,
      due_date: v.due_date || null,
      priority: v.priority,
      status: v.status,
      requires_evidence: v.requires_evidence ?? false,
      manager_remarks: v.manager_remarks || null,
    })
    .select("id")
    .single();

  if (error || !task) {
    return { ok: false, error: friendlyError(error) };
  }

  await supabase.from("task_updates").insert({
    task_id: task.id,
    actor_id: manager.id,
    action: "created",
    remark: v.manager_remarks || null,
  });

  if (v.assigned_to) {
    await supabase.from("task_updates").insert({
      task_id: task.id,
      actor_id: manager.id,
      action: "assigned",
      field: "assigned_to",
      new_value: v.assigned_to,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  return { ok: true };
}

export async function updateTask(taskId: string, formData: FormData): Promise<ActionResult> {
  const manager = await requireRole("manager");
  const supabase = await createClient();

  const { data: existing } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (!existing) return { ok: false, error: "This task no longer exists." };

  const raw = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category_id: String(formData.get("category_id") ?? ""),
    assigned_to: String(formData.get("assigned_to") ?? ""),
    due_date: String(formData.get("due_date") ?? ""),
    priority: String(formData.get("priority") ?? "MEDIUM"),
    status: String(formData.get("status") ?? existing.status),
    requires_evidence: formData.get("requires_evidence") === "on",
    manager_remarks: String(formData.get("manager_remarks") ?? ""),
  };

  const parsed = taskFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const v = parsed.data;

  const changes: { field: string; old: unknown; next: unknown }[] = [];
  const patch: Record<string, unknown> = {
    title: v.title,
    description: v.description || null,
    category_id: v.category_id || null,
    assigned_to: v.assigned_to || null,
    due_date: v.due_date || null,
    priority: v.priority,
    status: v.status,
    requires_evidence: v.requires_evidence ?? false,
    manager_remarks: v.manager_remarks || null,
  };

  for (const [field, next] of Object.entries(patch)) {
    const old = (existing as Record<string, unknown>)[field];
    if ((old ?? null) !== (next ?? null)) changes.push({ field, old, next });
  }

  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
  if (error) return { ok: false, error: friendlyError(error) };

  for (const c of changes) {
    await supabase.from("task_updates").insert({
      task_id: taskId,
      actor_id: manager.id,
      action: c.field === "status" ? "status_changed" : c.field === "assigned_to" ? "assigned" : "edited",
      field: c.field,
      old_value: c.old === null || c.old === undefined ? null : String(c.old),
      new_value: c.next === null || c.next === undefined ? null : String(c.next),
    });
  }

  if (v.status === "COMPLETED" && existing.status !== "COMPLETED") {
    await supabase.from("tasks").update({ completed_at: new Date().toISOString() }).eq("id", taskId);
  }

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function archiveTask(taskId: string): Promise<ActionResult> {
  await requireRole("manager");
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ is_archived: true }).eq("id", taskId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  return { ok: true };
}

/** Manager quick action: NOT_STARTED -> IN_PROGRESS -> COMPLETED (same rules as staff, direct table access). */
export async function managerQuickStatus(taskId: string, status: "IN_PROGRESS" | "COMPLETED"): Promise<ActionResult> {
  const manager = await requireRole("manager");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("tasks").select("status").eq("id", taskId).maybeSingle();
  if (!existing) return { ok: false, error: "This task no longer exists." };

  const patch: Record<string, unknown> = { status };
  if (status === "COMPLETED") patch.completed_at = new Date().toISOString();

  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
  if (error) return { ok: false, error: friendlyError(error) };

  await supabase.from("task_updates").insert({
    task_id: taskId,
    actor_id: manager.id,
    action: "status_changed",
    field: "status",
    old_value: existing.status,
    new_value: status,
  });

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function submitForApproval(taskId: string): Promise<ActionResult> {
  const manager = await requireRole("manager");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("tasks").select("status").eq("id", taskId).maybeSingle();
  if (!existing) return { ok: false, error: "This task no longer exists." };
  if (existing.status !== "COMPLETED") {
    return { ok: false, error: "Only completed tasks can be submitted for approval." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status: "AWAITING_APPROVAL", submitted_for_approval_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) return { ok: false, error: friendlyError(error) };

  await supabase.from("task_updates").insert({
    task_id: taskId,
    actor_id: manager.id,
    action: "submitted_for_approval",
    field: "status",
    old_value: "COMPLETED",
    new_value: "AWAITING_APPROVAL",
  });

  revalidatePath("/dashboard");
  revalidatePath("/owner");
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function reopenTask(taskId: string, remark?: string): Promise<ActionResult> {
  const manager = await requireRole("manager");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("tasks").select("status").eq("id", taskId).maybeSingle();
  if (!existing) return { ok: false, error: "This task no longer exists." };

  const { error } = await supabase
    .from("tasks")
    .update({ status: "IN_PROGRESS", completed_at: null, submitted_for_approval_at: null })
    .eq("id", taskId);
  if (error) return { ok: false, error: friendlyError(error) };

  await supabase.from("task_updates").insert({
    task_id: taskId,
    actor_id: manager.id,
    action: "reopened",
    field: "status",
    old_value: existing.status,
    new_value: "IN_PROGRESS",
    remark: remark || null,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

/** Staff: move own assigned task NOT_STARTED -> IN_PROGRESS -> COMPLETED via the security-definer RPC. */
export async function staffUpdateStatus(taskId: string, status: "IN_PROGRESS" | "COMPLETED"): Promise<ActionResult> {
  await requireRole("staff");
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_update_task_status", {
    p_task_id: taskId,
    p_new_status: status,
  });
  if (error) return { ok: false, error: "Couldn't update this task. Check your connection and try again." };

  revalidatePath("/my-tasks");
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function addRemark(taskId: string, formData: FormData): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };

  const parsed = remarkSchema.safeParse({ remark: String(formData.get("remark") ?? "") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const supabase = await createClient();

  if (profile.role === "manager") {
    const { error } = await supabase.from("tasks").update({ manager_remarks: parsed.data.remark }).eq("id", taskId);
    if (error) return { ok: false, error: "Couldn't save this remark. Check your connection and try again." };
    await supabase.from("task_updates").insert({
      task_id: taskId,
      actor_id: profile.id,
      action: "remark_added",
      field: "manager_remarks",
      new_value: parsed.data.remark,
      remark: parsed.data.remark,
    });
  } else if (profile.role === "staff") {
    const { error } = await supabase.rpc("add_staff_remark", {
      p_task_id: taskId,
      p_remark: parsed.data.remark,
    });
    if (error) return { ok: false, error: "Couldn't save this remark. Check your connection and try again." };
  } else {
    return { ok: false, error: "Owners add remarks when reviewing an approval." };
  }

  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function ownerDecide(
  taskId: string,
  decision: "APPROVED" | "CHANGES_REQUESTED",
  remark?: string
): Promise<ActionResult> {
  await requireRole("owner");
  const supabase = await createClient();
  const { error } = await supabase.rpc("owner_decide_task", {
    p_task_id: taskId,
    p_decision: decision,
    p_remark: remark || null,
  });
  if (error) {
    return { ok: false, error: "Couldn't record your decision. Check your connection and try again." };
  }

  revalidatePath("/owner");
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}
