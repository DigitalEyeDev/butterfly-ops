"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { createDepartment, setDepartmentActive } from "@/lib/actions/departments";
import type { Department } from "@/lib/types";

/**
 * Add/deactivate departments — organizational grouping only (see
 * supabase/departments.sql). A new department is immediately selectable
 * on the "Add team member" form, no deploy required.
 */
export function DepartmentManager({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setFieldError(undefined);
    try {
      const result = await createDepartment(formData);
      if (result.ok) {
        success("Department added.");
        formRef.current?.reset();
        router.refresh();
      } else {
        setFieldError(result.error);
      }
    } catch {
      error("Couldn't create this department. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function toggle(dept: Department) {
    setTogglingId(dept.id);
    startTransition(async () => {
      try {
        const result = await setDepartmentActive(dept.id, !dept.is_active);
        if (result.ok) {
          success(dept.is_active ? `${dept.name} deactivated.` : `${dept.name} reactivated.`);
          router.refresh();
        } else {
          error(result.error ?? "Couldn't update this department.");
        }
      } finally {
        setTogglingId(null);
      }
    });
  }

  return (
    <div>
      <form ref={formRef} action={handleSubmit} className="flex items-start gap-2">
        <FieldGroup className="mb-0 flex-1">
          <Label htmlFor="dept_name">Department name</Label>
          <Input id="dept_name" name="name" required placeholder="e.g. Electrical" />
          <input type="hidden" name="description" value="" />
          {fieldError && <FieldError>{fieldError}</FieldError>}
        </FieldGroup>
        <Button type="submit" loading={pending} className="mt-[26px]">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      <div className="mt-4">
        {departments.length === 0 ? (
          <EmptyState icon={Building2} title="No departments yet" description="Add your first department above." />
        ) : (
          <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface">
            {departments.map((dept) => (
              <li key={dept.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className={dept.is_active ? "truncate text-sm font-medium" : "truncate text-sm font-medium text-muted"}>
                    {dept.name}
                  </p>
                  {!dept.is_active && <p className="text-xs text-muted">Inactive</p>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  loading={togglingId === dept.id}
                  onClick={() => toggle(dept)}
                >
                  {dept.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
