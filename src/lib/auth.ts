import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

/**
 * Loads the signed-in user's profile (role, branch, name). Returns null
 * when nobody is signed in — callers decide whether that means "redirect
 * to /login" or "render a signed-out state".
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, branch_id, full_name, role, is_active, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;
  return { ...profile, email: user.email ?? undefined };
}

/**
 * Server Component / Server Action guard: redirects to /login if signed
 * out, and to a role-appropriate home if signed in but not authorized.
 * This is a UX convenience only — the real enforcement is RLS + the RPC
 * functions in supabase/schema.sql, which check role independently.
 */
export async function requireRole(...roles: UserRole[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (roles.length && !roles.includes(profile.role)) {
    redirect(homeForRole(profile.role));
  }
  return profile;
}

export function homeForRole(role: UserRole): string {
  switch (role) {
    case "manager":
      return "/dashboard";
    case "owner":
      return "/owner";
    case "staff":
      return "/my-tasks";
  }
}
