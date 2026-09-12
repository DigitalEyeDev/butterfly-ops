import { requireRole } from "@/lib/auth";
import { getTasks, getCategories, getStaff } from "@/lib/queries";
import { TaskFilterBar } from "@/components/tasks/TaskFilterBar";
import { TaskList } from "@/components/tasks/TaskList";
import { AddTaskFab } from "@/components/tasks/AddTaskFab";
import type { TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireRole("manager", "owner");
  const sp = await searchParams;

  const [tasks, categories, staff] = await Promise.all([
    getTasks(profile.branch_id, {
      status: sp.status as TaskStatus | undefined,
      dueBucket: sp.due as "today" | "week" | "overdue" | undefined,
      categoryId: sp.category,
      assignedTo: sp.assignee,
      priority: sp.priority,
      search: sp.q,
    }),
    getCategories(profile.branch_id),
    getStaff(profile.branch_id),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">All tasks</h1>
        <p className="text-sm text-muted">{tasks.length} task{tasks.length === 1 ? "" : "s"}</p>
      </header>

      <TaskFilterBar categories={categories} staff={staff} />

      <TaskList
        tasks={tasks}
        role={profile.role}
        emptyTitle="No tasks match these filters"
        emptyDescription="Try clearing a filter or searching something else."
      />

      {profile.role === "manager" && <AddTaskFab categories={categories} staff={staff} />}
    </div>
  );
}
