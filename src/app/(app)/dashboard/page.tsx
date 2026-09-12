import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getTasks, computeMetrics, getCategories, getStaff, getRecentActivity } from "@/lib/queries";
import { MetricGrid } from "@/components/dashboard/MetricGrid";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { TaskList } from "@/components/tasks/TaskList";
import { AddTaskFab } from "@/components/tasks/AddTaskFab";
import { greeting, formatDate, isOverdue } from "@/lib/utils";
import type { Task, TaskUpdate } from "@/lib/types";

export const dynamic = "force-dynamic";

function priorityRank(p: Task["priority"]) {
  return { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[p];
}

export default async function DashboardPage() {
  const manager = await requireRole("manager");

  const [tasks, categories, staff, activity] = await Promise.all([
    getTasks(manager.branch_id),
    getCategories(manager.branch_id),
    getStaff(manager.branch_id),
    getRecentActivity(manager.branch_id),
  ]);

  const metrics = computeMetrics(tasks);

  const priorities = tasks
    .filter((t) => !["COMPLETED", "AWAITING_APPROVAL", "APPROVED"].includes(t.status))
    .filter((t) => isOverdue(t.due_date, t.status) || t.priority === "HIGH" || t.priority === "URGENT")
    .sort((a, b) => {
      const aOverdue = isOverdue(a.due_date, a.status);
      const bOverdue = isOverdue(b.due_date, b.status);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return priorityRank(a.priority) - priorityRank(b.priority);
    })
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <p className="text-sm font-medium text-muted">{formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {greeting()}, {manager.full_name.split(" ")[0]}
        </h1>
      </header>

      <section className="mb-8">
        <MetricGrid metrics={metrics} />
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Today&apos;s priorities</h2>
          <Link href="/tasks" className="text-sm font-medium text-brand hover:underline">
            View all
          </Link>
        </div>
        <TaskList
          tasks={priorities}
          role="manager"
          emptyTitle="Nothing urgent right now 🎉"
          emptyDescription="No overdue or high-priority tasks need attention."
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
        <RecentActivity activity={activity as (TaskUpdate & { task: { id: string; title: string } })[]} />
      </section>

      <AddTaskFab categories={categories} staff={staff} />
    </div>
  );
}
