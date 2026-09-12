"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/actions/auth";

// A ban this long is Supabase's documented way to permanently disable an
// auth account without deleting it — deleting would cascade-delete the
// profile row (and, since tasks/task_updates/evidence/approvals reference
// profiles without ON DELETE CASCADE, that would actually fail outright
// once the person has any history — but even if it didn't, it would erase
// exactly the historical names/records this feature is required to keep).
const PERMANENT_BAN_DURATION = "876000h"; // ~100 years

export async function createTeamMember(formData: FormData): Promise<ActionResult> {
  const manager = await requireRole("manager");

  const parsed = createUserSchema.safeParse({
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "staff"),
    password: String(formData.get("password") ?? ""),
    department_id: String(formData.get("department_id") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const v = parsed.data;

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    const message = createError?.message?.includes("already been registered")
      ? "An account with that email already exists."
      : "Couldn't create this account. Check your connection and try again.";
    return { ok: false, error: message };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    branch_id: manager.branch_id,
    full_name: v.full_name,
    role: v.role,
    department_id: v.department_id || null,
    is_active: true,
    status: "ACTIVE",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: "Couldn't finish setting up this account. Please try again." };
  }

  revalidatePath("/team");
  return { ok: true };
}

export async function setTeamMemberActive(profileId: string, isActive: boolean): Promise<ActionResult> {
  const manager = await requireRole("manager");
  const supabase = await createClient();

  const { data: target } = await supabase.from("profiles").select("status").eq("id", profileId).maybeSingle();
  if (!target) return { ok: false, error: "This account no longer exists." };
  if (target.status === "REMOVED") {
    return { ok: false, error: "This account has been removed and can't be reactivated. Create a new account instead." };
  }
  if (profileId === manager.id && !isActive) {
    return { ok: false, error: "You can't deactivate your own account." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive, status: isActive ? "ACTIVE" : "DEACTIVATED" })
    .eq("id", profileId);
  if (error) return { ok: false, error: "Couldn't update this account. Check your connection and try again." };
  revalidatePath("/team");
  return { ok: true };
}

/**
 * Permanently deprovisions a team member: revokes login (RLS now denies
 * them everywhere via `current_profile_role`/`current_profile_branch`
 * resolving to NULL for an inactive account, and their auth account is
 * banned so they can't sign in or refresh a session again), removes them
 * from future assignment (task/staff pickers already filter on
 * `is_active`), while every historical task, remark, approval, and
 * activity entry keeps their name exactly as it was.
 */
export async function removeTeamMember(profileId: string): Promise<ActionResult> {
  const manager = await requireRole("manager");

  if (profileId === manager.id) {
    return { ok: false, error: "You can't remove your own account." };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("role, status, full_name")
    .eq("id", profileId)
    .maybeSingle();

  if (!target) return { ok: false, error: "This account no longer exists." };
  if (target.status === "REMOVED") return { ok: false, error: "This account has already been removed." };

  if (target.role === "manager") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", manager.branch_id)
      .eq("role", "manager")
      .eq("status", "ACTIVE")
      .neq("id", profileId);
    if (!count) {
      return { ok: false, error: "You can't remove the only active manager. Add another manager first." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status: "REMOVED", is_active: false, removed_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) return { ok: false, error: "Couldn't remove this account. Check your connection and try again." };

  // Best-effort: also ban the auth account so a still-valid session can't
  // be refreshed. If this call fails (e.g. transient network issue), the
  // RLS-level lockout above already blocks every read/write they could
  // make, so access is still fully revoked — this just adds defense in
  // depth against a long-lived token.
  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(profileId, { ban_duration: PERMANENT_BAN_DURATION });
  } catch {
    // Non-fatal — see comment above.
  }

  revalidatePath("/team");
  revalidatePath("/tasks");
  return { ok: true };
}
