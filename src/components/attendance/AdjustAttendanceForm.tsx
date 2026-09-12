"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/Overlay";
import { Select, Textarea, Label, FieldGroup, FieldError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { adjustAttendance } from "@/lib/actions/attendance";
import { ATTENDANCE_RECORD_STATUSES, ATTENDANCE_STATUS_LABELS } from "@/lib/types";
import type { AttendanceRecordStatus } from "@/lib/types";

export function AdjustAttendanceForm({ recordId, currentStatus }: { recordId: string; currentStatus: AttendanceRecordStatus }) {
  const { success, error } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setFieldError(undefined);
    try {
      const result = await adjustAttendance(recordId, formData);
      if (result.ok) {
        success("Attendance record adjusted.");
        setOpen(false);
        router.refresh();
      } else {
        setFieldError(result.error);
      }
    } catch {
      error("Couldn't save this adjustment. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wrench className="h-3.5 w-3.5" /> Adjust record
      </Button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Adjust attendance">
        <p className="mb-4 text-sm text-muted">
          Every adjustment is logged with your name, the reason, and the previous value — it&apos;s never silent.
        </p>
        <form action={handleSubmit}>
          <FieldGroup>
            <Label htmlFor="new_status">New status</Label>
            <Select id="new_status" name="new_status" defaultValue={currentStatus}>
              {ATTENDANCE_RECORD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ATTENDANCE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="reason" required>
              Reason
            </Label>
            <Textarea id="reason" name="reason" rows={3} required placeholder="e.g. Forgot to clock out — confirmed with employee" />
          </FieldGroup>
          {fieldError && <FieldError>{fieldError}</FieldError>}
          <Button type="submit" fullWidth loading={pending}>
            Save adjustment
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
