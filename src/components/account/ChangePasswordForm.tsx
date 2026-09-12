"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/Field";
import { updateOwnPassword } from "@/lib/actions/account";

export function ChangePasswordForm() {
  const { success, error } = useToast();
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setFieldError(undefined);
    try {
      const result = await updateOwnPassword(formData);
      if (result.ok) {
        success("Password updated.");
        formRef.current?.reset();
      } else {
        setFieldError(result.error);
      }
    } catch {
      error("Couldn't update your password. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} action={handleSubmit}>
      <FieldGroup>
        <Label htmlFor="password" required>
          New password
        </Label>
        <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="confirm" required>
          Confirm new password
        </Label>
        <Input id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
      </FieldGroup>
      {fieldError && <FieldError>{fieldError}</FieldError>}
      <Button type="submit" fullWidth loading={pending} className="mt-2">
        Update password
      </Button>
    </form>
  );
}
