import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client — SERVER ONLY, never imported from a Client
// Component. Bypasses RLS entirely, so every call site must do its own
// authorization check (see lib/auth.ts requireRole) before using it.
// Used only for: creating staff/owner accounts and generating signed
// evidence URLs.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role is not configured on the server.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
