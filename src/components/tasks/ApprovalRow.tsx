import Link from "next/link";
import { CategoryTag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { relativeTime } from "@/lib/utils";
import type { Task } from "@/lib/types";

export function ApprovalRow({ task }: { task: Task }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-warning-soft bg-warning-soft/40 p-4">
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{task.title}</p>
        <CategoryTag name={task.category?.name} />
        <p className="mt-1 text-sm text-muted">
          Completed by {task.assignee?.full_name ?? "manager"} · {relativeTime(task.completed_at ?? task.updated_at)}
        </p>
      </div>
      <Link href={`/tasks/${task.id}`}>
        <Button size="sm">Review</Button>
      </Link>
    </div>
  );
}
