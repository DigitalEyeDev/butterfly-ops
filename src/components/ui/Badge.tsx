import { cn } from "@/lib/utils";
import {
  ACCOUNT_STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type AccountStatus,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";

const statusTone: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-neutral-soft text-neutral",
  IN_PROGRESS: "bg-info-soft text-info",
  COMPLETED: "bg-success-soft text-success",
  AWAITING_APPROVAL: "bg-warning-soft text-warning",
  CHANGES_REQUESTED: "bg-danger-soft text-danger",
  APPROVED: "bg-brand-soft text-brand-strong",
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const needsAttention = status === "AWAITING_APPROVAL";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        statusTone[status],
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {needsAttention && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {STATUS_LABELS[status]}
    </span>
  );
}

const priorityTone: Record<TaskPriority, string> = {
  LOW: "text-neutral bg-neutral-soft",
  MEDIUM: "text-info bg-info-soft",
  HIGH: "text-warning bg-warning-soft",
  URGENT: "text-danger bg-danger-soft",
};

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  const isUrgent = priority === "URGENT";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        priorityTone[priority],
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {isUrgent && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

const accountStatusTone: Record<AccountStatus, string> = {
  ACTIVE: "bg-success-soft text-success",
  DEACTIVATED: "bg-neutral-soft text-neutral",
  REMOVED: "bg-danger-soft text-danger",
};

export function AccountStatusBadge({ status, className }: { status: AccountStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        accountStatusTone[status],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ACCOUNT_STATUS_LABELS[status]}
    </span>
  );
}

export function CategoryTag({ name, className }: { name?: string | null; className?: string }) {
  if (!name) return null;
  return (
    <span className={cn("text-xs font-medium uppercase tracking-wide text-muted", className)}>
      {name}
    </span>
  );
}
