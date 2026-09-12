import { requireRole } from "@/lib/auth";
import { getAllTeam, getDepartments } from "@/lib/queries";
import { TeamPageClient } from "@/components/team/TeamPageClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  // Owner can view Team + manage departments; only a manager can actually
  // create/deactivate/remove people — TeamPageClient hides those controls
  // for an owner viewer, and the underlying actions in lib/actions/users.ts
  // still enforce manager-only server-side regardless of what the UI shows.
  const viewer = await requireRole("manager", "owner");
  const [team, departments] = await Promise.all([
    getAllTeam(viewer.branch_id),
    getDepartments(viewer.branch_id, false),
  ]);

  return <TeamPageClient team={team} departments={departments} currentUserId={viewer.id} canManageMembers={viewer.role === "manager"} />;
}
