"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Textarea, Label, FieldGroup, FieldError } from "@/components/ui/Field";

export function RequestCorrectionDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function handleConfirm() {
    setLoading(true);
    setFieldError(undefined);
    try {
      const result = await onConfirm(reason);
      if (result.ok) {
        setReason("");
        onClose();
      } else {
        setFieldError(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title="Request a correction"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" fullWidth onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button fullWidth loading={loading} onClick={handleConfirm}>
            Send back for correction
          </Button>
        </div>
      }
    >
      <FieldGroup className="mb-0">
        <Label htmlFor="correction_reason" required>
          What needs to be fixed?
        </Label>
        <Textarea
          id="correction_reason"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Ticket count looks too high for a weekday — please double-check"
        />
        {fieldError && <FieldError>{fieldError}</FieldError>}
      </FieldGroup>
    </Modal>
  );
}
