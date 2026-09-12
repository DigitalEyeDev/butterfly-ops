"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/auth";

export async function updateOwnName(formData: FormData): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { ok: false, error: "Enter your name." };
  if (fullName.length > 120) return { ok: false, error: "Keep your name under 120 characters." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_own_full_name", { p_full_name: fullName });
  if (error) return { ok: false, error: "Couldn't update your name. Check your connection and try again." };

  revalidatePath("/account");
  return { ok: true };
}

export async function updateOwnPassword(formData: FormData): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (password !== confirm) return { ok: false, error: "Passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: "Couldn't update your password. Check your connection and try again." };

  return { ok: true };
}
