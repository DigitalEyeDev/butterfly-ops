import Link from "next/link";
import { relativeTime } from "@/lib/utils";
import type { TaskUpdate } from "@/lib/types";

const ACTION_TEXT: Record<string, string> = {
  created: "created",
  assigned: "assigned",
  status_changed: "updated status on",
  remark_added: "added a remark on",
  evidence_added: "attached evidence to",
  submitted_for_approval: "submitted for approval",
  approved: "approved",
  changes_requested: "requested changes on",
  reopened: "reopened",
  edited: "edited",
};

type ActivityRow = TaskUpdate & { task: { id: string; title: string } };

export function RecentActivity({ activity }: { activity: ActivityRow[] }) {
  if (activity.length === 0) {
    return <p className="text-sm text-muted">No activity yet.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface">
      {activity.map((a) => (
        <li key={a.id}>
          <Link href={`/tasks/${a.task.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface-muted">
            <p className="text-sm text-foreground">
              <span className="font-medium">{a.actor?.full_name ?? "System"}</span>{" "}
              <span className="text-muted">{ACTION_TEXT[a.action] ?? a.action.replace(/_/g, " ")}</span>{" "}
              <span className="font-medium">{a.task.title}</span>
            </p>
            <span className="shrink-0 text-xs text-muted">{relativeTime(a.created_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
