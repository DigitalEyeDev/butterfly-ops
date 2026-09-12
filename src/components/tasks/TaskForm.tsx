"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select, Label, FieldGroup, FieldError } from "@/components/ui/Field";
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/types";
import type { Category, Profile, Task } from "@/lib/types";
import type { ActionResult } from "@/lib/actions/auth";

export function TaskForm({
  task,
  categories,
  staff,
  action,
  onSuccess,
  submitLabel = "Create task",
}: {
  task?: Task;
  categories: Category[];
  staff: Profile[];
  action: (formData: FormData) => Promise<ActionResult>;
  onSuccess: () => void;
  submitLabel?: string;
}) {
  const { success, error } = useToast();
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setFieldError(undefined);
    try {
      const result = await action(formData);
      if (result.ok) {
        success(task ? "Task updated." : "Task created.");
        onSuccess();
      } else {
        setFieldError(result.error);
      }
    } catch {
      error("Couldn't save this task. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <FieldGroup>
        <Label htmlFor="title" required>
          Task title
        </Label>
        <Input id="title" name="title" required defaultValue={task?.title} placeholder="e.g. AC installation in play area" maxLength={200} />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={task?.description ?? ""} placeholder="Optional details" />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup>
          <Label htmlFor="category_id">Category</Label>
          <Select id="category_id" name="category_id" defaultValue={task?.category_id ?? ""}>
            <option value="">Not set</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="assigned_to">Assign to</Label>
          <Select id="assigned_to" name="assigned_to" defaultValue={task?.assigned_to ?? ""}>
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </Select>
        </FieldGroup>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup>
          <Label htmlFor="due_date">Due date</Label>
          <Input id="due_date" name="due_date" type="date" defaultValue={task?.due_date ?? ""} />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" name="priority" defaultValue={task?.priority ?? "MEDIUM"}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
        </FieldGroup>
      </div>

      {task && (
        <FieldGroup>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={task.status}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FieldGroup>
      )}

      <FieldGroup>
        <Label htmlFor="manager_remarks">Manager remarks</Label>
        <Textarea id="manager_remarks" name="manager_remarks" rows={2} defaultValue={task?.manager_remarks ?? ""} placeholder="Optional notes for the assignee" />
      </FieldGroup>

      <label className="mb-4 flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="requires_evidence" defaultChecked={task?.requires_evidence} className="h-4 w-4 rounded border-border accent-[var(--brand)]" />
        Requires photo/document proof
      </label>

      {fieldError && <FieldError>{fieldError}</FieldError>}

      <Button type="submit" fullWidth size="lg" loading={pending} className="mt-2">
        {submitLabel}
      </Button>
    </form>
  );
}
