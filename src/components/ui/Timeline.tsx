import { formatDateTime } from "@/lib/utils";
import type { TaskUpdate } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  created: "Task created",
  assigned: "Assigned",
  status_changed: "Status changed",
  priority_changed: "Priority changed",
  due_date_changed: "Due date changed",
  remark_added: "Remark added",
  evidence_added: "Evidence attached",
  submitted_for_approval: "Submitted for owner approval",
  approved: "Approved by owner",
  changes_requested: "Owner requested changes",
  reopened: "Reopened",
  edited: "Task edited",
};

function describe(update: TaskUpdate): string {
  const label = ACTION_LABELS[update.action] ?? update.action.replace(/_/g, " ");
  if (update.action === "status_changed" && update.old_value && update.new_value) {
    return `Status changed to ${update.new_value.replace(/_/g, " ").toLowerCase()}`;
  }
  return label;
}

export function Timeline({ updates }: { updates: TaskUpdate[] }) {
  if (updates.length === 0) {
    return <p className="text-sm text-muted">No activity recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {updates.map((u) => (
        <li key={u.id} className="relative">
          <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand" />
          <p className="text-sm font-medium text-foreground">{describe(u)}</p>
          {u.remark && <p className="mt-0.5 text-sm text-muted">&ldquo;{u.remark}&rdquo;</p>}
          <p className="mt-0.5 text-xs text-muted">
            {u.actor?.full_name ?? "System"} · {formatDateTime(u.created_at)}
          </p>
        </li>
      ))}
    </ol>
  );
}
