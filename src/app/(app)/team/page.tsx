import { requireRole } from "@/lib/auth";
import { getAllTeam } from "@/lib/queries";
import { TeamPageClient } from "@/components/team/TeamPageClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const manager = await requireRole("manager");
  const team = await getAllTeam(manager.branch_id);

  return <TeamPageClient team={team} currentUserId={manager.id} />;
}
