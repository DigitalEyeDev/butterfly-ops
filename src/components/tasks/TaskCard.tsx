"use client";

import Link from "next/link";
import { Calendar, ClipboardCheck, Play, ShieldCheck } from "lucide-react";
import { PriorityBadge, StatusBadge, CategoryTag } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn, formatDateShort, isOverdue } from "@/lib/utils";
import type { Task, UserRole } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  role: UserRole;
  onQuickAction?: (task: Task, action: "start" | "complete" | "submit") => void;
  quickActionLoading?: boolean;
}

export function TaskCard({ task, role, onQuickAction, quickActionLoading }: TaskCardProps) {
  const overdue = isOverdue(task.due_date, task.status);

  let quickAction: { label: string; action: "start" | "complete" | "submit"; icon: typeof Play } | null = null;
  if (role === "staff" && (task.status === "NOT_STARTED" || task.status === "CHANGES_REQUESTED")) {
    quickAction = { label: "Start task", action: "start", icon: Play };
  } else if (role === "staff" && task.status === "IN_PROGRESS") {
    quickAction = { label: "Mark completed", action: "complete", icon: ClipboardCheck };
  } else if (role === "manager" && task.status === "COMPLETED") {
    quickAction = { label: "Submit for approval", action: "submit", icon: ShieldCheck };
  } else if (role === "manager" && (task.status === "NOT_STARTED" || task.status === "CHANGES_REQUESTED")) {
    quickAction = { label: "Start task", action: "start", icon: Play };
  } else if (role === "manager" && task.status === "IN_PROGRESS") {
    quickAction = { label: "Mark completed", action: "complete", icon: ClipboardCheck };
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-md)] border bg-surface p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]",
        overdue ? "border-danger/40" : "border-border"
      )}
    >
      <Link href={`/tasks/${task.id}`} className="flex flex-col gap-2">
        <div>
          <p className="font-semibold leading-snug text-foreground">{task.title}</p>
          <CategoryTag name={task.category?.name} className="mt-0.5" />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
          {task.assignee && (
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={task.assignee.full_name} size="sm" />
              {task.assignee.full_name}
            </span>
          )}
          {!task.assignee && <span className="italic text-muted">Unassigned</span>}
          <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-danger")}>
            <Calendar className="h-3.5 w-3.5" />
            {task.due_date ? `Due ${formatDateShort(task.due_date)}` : "No due date"}
            {overdue && " · Overdue"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
      </Link>

      {quickAction && onQuickAction && (
        <Button
          size="sm"
          variant="outline"
          loading={quickActionLoading}
          onClick={() => onQuickAction(task, quickAction!.action)}
          className="self-start"
        >
          <quickAction.icon className="h-3.5 w-3.5" />
          {quickAction.label}
        </Button>
      )}
    </div>
  );
}
