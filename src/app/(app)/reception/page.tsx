import { requireRole } from "@/lib/auth";
import { getTodayReceptionReport, getReceptionHistory } from "@/lib/queries";
import { ReceptionistView } from "@/components/reception/ReceptionistView";
import { ManagerReceptionView } from "@/components/reception/ManagerReceptionView";
import { OwnerReceptionView } from "@/components/reception/OwnerReceptionView";

export const dynamic = "force-dynamic";

/**
 * One route serves all three roles that can see Reception (receptionist,
 * manager, owner) — same model as /attendance, which already serves both
 * manager and owner from a single page. Content branches by role because
 * the receptionist's workflow (fill in → attach evidence → submit) is
 * meaningfully different from the manager/owner review experience.
 */
export default async function ReceptionPage() {
  const profile = await requireRole("receptionist", "manager", "owner");

  const [today, history] = await Promise.all([
    getTodayReceptionReport(profile.branch_id),
    getReceptionHistory(profile.branch_id),
  ]);

  // Today's row (if any) also appears at the top of `history` — exclude it
  // there so it isn't shown twice on the page.
  const pastHistory = history.filter((r) => r.id !== today?.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Reception</h1>
        <p className="text-sm text-muted">
          {profile.role === "receptionist"
            ? "Today's visitor, ticket, sock, and review numbers — verified by evidence."
            : "Daily front-desk operations, verified against evidence."}
        </p>
      </header>

      {profile.role === "receptionist" && <ReceptionistView report={today} history={pastHistory} />}
      {profile.role === "manager" && <ManagerReceptionView report={today} history={pastHistory} />}
      {profile.role === "owner" && <OwnerReceptionView report={today} history={pastHistory} />}
    </div>
  );
}
