"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Play, ClipboardCheck, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Button, IconButton } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/Overlay";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { MoreVertical } from "lucide-react";
import { TaskForm } from "@/components/tasks/TaskForm";
import {
  managerQuickStatus,
  staffUpdateStatus,
  submitForApproval,
  reopenTask,
  archiveTask,
  updateTask,
} from "@/lib/actions/tasks";
import type { Category, Profile, Task, UserRole } from "@/lib/types";

export function TaskDetailActions({
  task,
  role,
  categories,
  staff,
}: {
  task: Task;
  role: UserRole;
  categories: Category[];
  staff: Profile[];
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, successMsg: string) {
    setPending(true);
    try {
      const result = await fn();
      if (result.ok) {
        success(successMsg);
        router.refresh();
      } else {
        error(result.error ?? "Couldn't update this task. Check your connection and try again.");
      }
    } catch {
      error("Couldn't update this task. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const canActOnStatus = role === "manager" || role === "staff";
  const canStart = canActOnStatus && (task.status === "NOT_STARTED" || task.status === "CHANGES_REQUESTED");
  const canComplete = canActOnStatus && task.status === "IN_PROGRESS";
  const canSubmit = role === "manager" && task.status === "COMPLETED";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canStart && (
        <Button
          variant="outline"
          loading={pending}
          onClick={() =>
            run(
              () => (role === "staff" ? staffUpdateStatus(task.id, "IN_PROGRESS") : managerQuickStatus(task.id, "IN_PROGRESS")),
              "Task started."
            )
          }
        >
          <Play className="h-4 w-4" /> Start task
        </Button>
      )}
      {canComplete && (
        <Button
          variant="outline"
          loading={pending}
          onClick={() =>
            run(
              () => (role === "staff" ? staffUpdateStatus(task.id, "COMPLETED") : managerQuickStatus(task.id, "COMPLETED")),
              "Task marked completed."
            )
          }
        >
          <ClipboardCheck className="h-4 w-4" /> Mark completed
        </Button>
      )}
      {canSubmit && (
        <Button loading={pending} onClick={() => run(() => submitForApproval(task.id), "Submitted for owner approval.")}>
          <ShieldCheck className="h-4 w-4" /> Submit for approval
        </Button>
      )}

      {role === "manager" && (
        <>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>

          <Dropdown
            trigger={
              <IconButton label="More actions" variant="outline">
                <MoreVertical className="h-4 w-4" />
              </IconButton>
            }
            options={[
              ...(task.status === "AWAITING_APPROVAL" || task.status === "CHANGES_REQUESTED"
                ? [{ label: "Reopen task", onSelect: () => run(() => reopenTask(task.id), "Task reopened.") }]
                : []),
              { label: "Archive task", destructive: true, onSelect: () => setArchiveOpen(true) },
            ]}
          />
        </>
      )}

      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit task">
        <TaskForm
          task={task}
          categories={categories}
          staff={staff}
          action={(formData) => updateTask(task.id, formData)}
          onSuccess={() => {
            setEditOpen(false);
            router.refresh();
          }}
          submitLabel="Save changes"
        />
      </BottomSheet>

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => run(() => archiveTask(task.id), "Task archived.")}
        title="Archive this task?"
        description="It will be hidden from the active task list but kept for records."
        confirmLabel="Archive"
        destructive
      />
    </div>
  );
}
