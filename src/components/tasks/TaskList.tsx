"use client";

import { useState, useTransition } from "react";
import { TaskCard } from "@/components/tasks/TaskCard";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { managerQuickStatus, submitForApproval, staffUpdateStatus } from "@/lib/actions/tasks";
import { ClipboardList } from "lucide-react";
import type { Task, UserRole } from "@/lib/types";

export function TaskList({
  tasks,
  role,
  emptyTitle = "No tasks here",
  emptyDescription = "Nothing matches right now.",
}: {
  tasks: Task[];
  role: UserRole;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const { success, error } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (tasks.length === 0) {
    return <EmptyState icon={ClipboardList} title={emptyTitle} description={emptyDescription} />;
  }

  function handleQuickAction(task: Task, action: "start" | "complete" | "submit") {
    setPendingId(task.id);
    startTransition(async () => {
      try {
        let result;
        if (action === "submit") {
          result = await submitForApproval(task.id);
        } else if (role === "staff") {
          result = await staffUpdateStatus(task.id, action === "start" ? "IN_PROGRESS" : "COMPLETED");
        } else {
          result = await managerQuickStatus(task.id, action === "start" ? "IN_PROGRESS" : "COMPLETED");
        }

        if (result.ok) {
          success(
            action === "start"
              ? "Task started."
              : action === "complete"
              ? "Task marked completed."
              : "Submitted for owner approval."
          );
        } else {
          error(result.error ?? "Couldn't update this task. Check your connection and try again.");
        }
      } catch {
        error("Couldn't update this task. Check your connection and try again.");
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          role={role}
          onQuickAction={handleQuickAction}
          quickActionLoading={pendingId === task.id}
        />
      ))}
    </div>
  );
}
