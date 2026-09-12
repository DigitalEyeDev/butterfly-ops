// One-time bootstrap: creates the very first Manager account (and the
// Bhubaneswar branch link) before anyone can sign in to use the Team page.
//
// Usage (from the project root, after filling in .env.local):
//   node --env-file=.env.local scripts/create-first-manager.mjs "Full Name" email@example.com "TempPass123"

import { createClient } from "@supabase/supabase-js";

const [, , fullName, email, password] = process.argv;

if (!fullName || !email || !password) {
  console.error('Usage: node --env-file=.env.local scripts/create-first-manager.mjs "Full Name" email password');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Check your .env.local.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: branch, error: branchError } = await admin.from("branches").select("id").eq("code", "BBSR").single();
if (branchError || !branch) {
  console.error("Couldn't find the Bhubaneswar branch. Did you run supabase/schema.sql first?");
  process.exit(1);
}

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createError || !created.user) {
  console.error("Couldn't create the auth user:", createError?.message);
  process.exit(1);
}

const { error: profileError } = await admin.from("profiles").insert({
  id: created.user.id,
  branch_id: branch.id,
  full_name: fullName,
  role: "manager",
  is_active: true,
});

if (profileError) {
  console.error("Couldn't create the profile row:", profileError.message);
  process.exit(1);
}

console.log(`✅ Manager account created for ${fullName} <${email}>. Sign in at /login.`);
