"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { addRemark } from "@/lib/actions/tasks";

export function RemarkForm({ taskId, placeholder = "Add a remark…" }: { taskId: string; placeholder?: string }) {
  const { success, error } = useToast();
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      const result = await addRemark(taskId, formData);
      if (result.ok) {
        success("Remark added.");
        formRef.current?.reset();
      } else {
        error(result.error ?? "Couldn't save this remark. Check your connection and try again.");
      }
    } catch {
      error("Couldn't save this remark. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Textarea name="remark" rows={2} placeholder={placeholder} required className="flex-1" />
      <Button type="submit" loading={pending} size="md">
        Post
      </Button>
    </form>
  );
}
