"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function signIn(prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { ok: false, error: "Couldn't sign in. Check your email and password and try again." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    const message =
      profile?.status === "REMOVED" || profile?.status === "DEACTIVATED"
        ? "This account no longer has access to Butterfly Ops. Contact your park manager."
        : "This account isn't set up yet. Ask your manager to add you.";
    return { ok: false, error: message };
  }

  redirect(homeForRole(profile.role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
