import { requireRole } from "@/lib/auth";
import { getTasks, computeMetrics } from "@/lib/queries";
import { MetricGrid } from "@/components/dashboard/MetricGrid";
import { TaskList } from "@/components/tasks/TaskList";
import { greeting, formatDate, isOverdue } from "@/lib/utils";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";

function priorityRank(p: Task["priority"]) {
  return { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[p];
}

export default async function MyTasksPage() {
  const staff = await requireRole("staff");
  const tasks = await getTasks(staff.branch_id, { onlyMine: staff.id });
  const metrics = computeMetrics(tasks);

  const active = tasks
    .filter((t) => !["COMPLETED", "AWAITING_APPROVAL", "APPROVED"].includes(t.status))
    .sort((a, b) => {
      const aOverdue = isOverdue(a.due_date, a.status);
      const bOverdue = isOverdue(b.due_date, b.status);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return priorityRank(a.priority) - priorityRank(b.priority);
    });

  const done = tasks.filter((t) => ["COMPLETED", "AWAITING_APPROVAL", "APPROVED"].includes(t.status));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <p className="text-sm font-medium text-muted">{formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {greeting()}, {staff.full_name.split(" ")[0]}
        </h1>
      </header>

      <section className="mb-8">
        <MetricGrid metrics={metrics} interactive={false} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">What you need to do</h2>
        <TaskList
          tasks={active}
          role="staff"
          emptyTitle="You're all caught up 🎉"
          emptyDescription="No open tasks assigned to you right now."
        />
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Recently done</h2>
          <TaskList tasks={done.slice(0, 6)} role="staff" />
        </section>
      )}
    </div>
  );
}
