"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ParsedImportRow } from "@/lib/import";
import type { ActionResult } from "@/lib/actions/auth";

const MAX_ROWS = 500;

export async function importTasks(rows: ParsedImportRow[]): Promise<ActionResult & { imported?: number }> {
  const manager = await requireRole("manager");

  const toInsert = rows
    .filter((r) => r.include && r.title.trim())
    .slice(0, MAX_ROWS)
    .map((r) => ({
      branch_id: manager.branch_id,
      title: r.title.trim().slice(0, 200),
      assigned_to: r.assigned_to,
      created_by: manager.id,
      due_date: r.due_date,
      priority: r.priority,
      status: r.status,
      manager_remarks: r.remarks.trim() || null,
      legacy_excel_id: r.legacy_id.trim() || null,
    }));

  if (toInsert.length === 0) {
    return { ok: false, error: "No valid rows to import — every row needs at least a title." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").insert(toInsert).select("id");

  if (error) {
    return { ok: false, error: "Couldn't import these tasks. Check your connection and try again." };
  }

  const historyRows = (data ?? []).map((t) => ({
    task_id: t.id,
    actor_id: manager.id,
    action: "created",
    remark: "Imported from Excel task board",
  }));
  if (historyRows.length) {
    await supabase.from("task_updates").insert(historyRows);
  }

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  return { ok: true, imported: data?.length ?? 0 };
}
