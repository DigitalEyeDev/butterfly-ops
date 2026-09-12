"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/Field";
import { updateOwnName } from "@/lib/actions/account";

export function EditNameForm({ initialName }: { initialName: string }) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setFieldError(undefined);
    try {
      const result = await updateOwnName(formData);
      if (result.ok) {
        success("Name updated.");
        router.refresh();
      } else {
        setFieldError(result.error);
      }
    } catch {
      error("Couldn't update your name. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <FieldGroup className="mb-3">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" defaultValue={initialName} required maxLength={120} />
      </FieldGroup>
      {fieldError && <FieldError>{fieldError}</FieldError>}
      <Button type="submit" loading={pending}>
        Save name
      </Button>
    </form>
  );
}
