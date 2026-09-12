import { redirect } from "next/navigation";
import { getCurrentProfile, homeForRole } from "@/lib/auth";

export default async function RootPage() {
  const profile = await getCurrentProfile();
  redirect(profile ? homeForRole(profile.role) : "/login");
}
