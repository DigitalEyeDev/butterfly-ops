"use client";

import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Button, IconButton } from "@/components/ui/Button";
import { Input, Select, Label, FieldGroup, FieldError } from "@/components/ui/Field";
import { createTeamMember } from "@/lib/actions/users";
import type { Department } from "@/lib/types";

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function CreateTeamMemberForm({ departments, onSuccess }: { departments: Department[]; onSuccess: () => void }) {
  const { success, error } = useToast();
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [password, setPassword] = useState(randomPassword);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setFieldError(undefined);
    try {
      const result = await createTeamMember(formData);
      if (result.ok) {
        success("Account created. Share the password with them securely.");
        formRef.current?.reset();
        setPassword(randomPassword());
        onSuccess();
      } else {
        setFieldError(result.error);
      }
    } catch {
      error("Couldn't create this account. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} action={handleSubmit}>
      <FieldGroup>
        <Label htmlFor="full_name" required>
          Full name
        </Label>
        <Input id="full_name" name="full_name" required placeholder="e.g. Rahul Sahoo" />
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input id="email" name="email" type="email" required placeholder="name@butterflypark.com" />
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="role" required>
          Role
        </Label>
        <Select id="role" name="role" defaultValue="staff">
          <option value="staff">Staff</option>
          <option value="receptionist">Receptionist</option>
          <option value="manager">Manager</option>
          <option value="owner">Owner</option>
        </Select>
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="department_id">Department</Label>
        <Select id="department_id" name="department_id" defaultValue="">
          <option value="">No department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-muted">Organizational grouping only — access is controlled by role.</p>
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="password" required>
          Temporary password
        </Label>
        <div className="flex gap-2">
          <Input id="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required className="flex-1" />
          <IconButton label="Generate new password" variant="outline" type="button" onClick={() => setPassword(randomPassword())}>
            <RefreshCw className="h-4 w-4" />
          </IconButton>
        </div>
        <p className="mt-1.5 text-xs text-muted">Share this with them directly — they can change it after signing in.</p>
      </FieldGroup>

      {fieldError && <FieldError>{fieldError}</FieldError>}

      <Button type="submit" fullWidth size="lg" loading={pending} className="mt-2">
        Create account
      </Button>
    </form>
  );
}
