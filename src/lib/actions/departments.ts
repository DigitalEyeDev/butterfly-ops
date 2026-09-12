"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { departmentFormSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/actions/auth";

/**
 * Departments are organizational grouping only — see the note at the top of
 * supabase/departments.sql. Manager or owner can add one here and it's
 * immediately assignable from the team-member form, no deploy required.
 */
export async function createDepartment(formData: FormData): Promise<ActionResult> {
  const manager = await requireRole("manager", "owner");

  const parsed = departmentFormSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("departments").insert({
    branch_id: manager.branch_id,
    name: v.name,
    description: v.description || null,
  });
  if (error) {
    const message = error.message.includes("duplicate key")
      ? "A department with that name already exists."
      : "Couldn't create this department. Check your connection and try again.";
    return { ok: false, error: message };
  }

  revalidatePath("/team");
  return { ok: true };
}

export async function setDepartmentActive(departmentId: string, isActive: boolean): Promise<ActionResult> {
  await requireRole("manager", "owner");

  const supabase = await createClient();
  const { error } = await supabase.from("departments").update({ is_active: isActive }).eq("id", departmentId);
  if (error) return { ok: false, error: "Couldn't update this department. Check your connection and try again." };

  revalidatePath("/team");
  return { ok: true };
}
