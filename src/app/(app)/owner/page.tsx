import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getTasks, computeMetrics, getTodayReceptionReport } from "@/lib/queries";
import { MetricGrid } from "@/components/dashboard/MetricGrid";
import { ApprovalRow } from "@/components/tasks/ApprovalRow";
import { TaskList } from "@/components/tasks/TaskList";
import { EmptyState } from "@/components/ui/States";
import { ReceptionSummaryCard } from "@/components/reception/ReceptionSummaryCard";
import { isOverdue } from "@/lib/utils";
import { PartyPopper, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
  const owner = await requireRole("owner");
  const [tasks, reception] = await Promise.all([getTasks(owner.branch_id), getTodayReceptionReport(owner.branch_id)]);
  const metrics = computeMetrics(tasks);

  const needsApproval = tasks
    .filter((t) => t.status === "AWAITING_APPROVAL")
    .sort((a, b) => new Date(a.submitted_for_approval_at ?? a.updated_at).getTime() - new Date(b.submitted_for_approval_at ?? b.updated_at).getTime());

  const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status));
  const highPriority = tasks.filter(
    (t) => (t.priority === "HIGH" || t.priority === "URGENT") && !["COMPLETED", "APPROVED", "AWAITING_APPROVAL"].includes(t.status)
  );
  const recentlyCompleted = tasks
    .filter((t) => t.status === "APPROVED" || t.status === "COMPLETED")
    .sort((a, b) => new Date(b.completed_at ?? b.updated_at).getTime() - new Date(a.completed_at ?? a.updated_at).getTime())
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">BUTTERFLY OPS</h1>
        <p className="text-sm font-medium uppercase tracking-wide text-muted">Bhubaneswar · Park operations</p>
      </header>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Today at Butterfly</h2>
          <Link href="/reception" className="flex items-center text-sm font-medium text-brand hover:underline">
            Reception <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ReceptionSummaryCard report={reception} condensed />
      </section>

      <section className="mb-8">
        <MetricGrid metrics={metrics} base="/tasks" show={["total", "completed", "inProgress", "overdue", "awaitingApproval"]} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Needs your approval</h2>
        {needsApproval.length === 0 ? (
          <EmptyState icon={PartyPopper} title="Nothing needs your approval right now 🎉" />
        ) : (
          <div className="space-y-3">
            {needsApproval.map((t) => (
              <ApprovalRow key={t.id} task={t} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Overdue</h2>
          <Link href="/tasks?due=overdue" className="text-sm font-medium text-brand hover:underline">
            View all
          </Link>
        </div>
        <TaskList tasks={overdue.slice(0, 5)} role="owner" emptyTitle="Nothing overdue" emptyDescription="Every open task is on track." />
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">High priority</h2>
          <Link href="/tasks?priority=HIGH" className="text-sm font-medium text-brand hover:underline">
            View all
          </Link>
        </div>
        <TaskList tasks={highPriority.slice(0, 5)} role="owner" emptyTitle="No open high-priority tasks" />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recently completed</h2>
        <TaskList tasks={recentlyCompleted} role="owner" emptyTitle="Nothing completed yet" />
      </section>
    </div>
  );
}
