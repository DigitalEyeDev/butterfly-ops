"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Undo2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { Textarea, Label, FieldGroup } from "@/components/ui/Field";
import { ownerDecide } from "@/lib/actions/tasks";

export function ApprovalActions({ taskId }: { taskId: string }) {
  const { success, error } = useToast();
  const router = useRouter();
  const [changesOpen, setChangesOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [pending, setPending] = useState<"approve" | "changes" | null>(null);

  async function approve() {
    setPending("approve");
    try {
      const result = await ownerDecide(taskId, "APPROVED");
      if (result.ok) {
        success("Task approved.");
        router.refresh();
      } else {
        error(result.error ?? "Couldn't record your decision. Check your connection and try again.");
      }
    } finally {
      setPending(null);
    }
  }

  async function requestChanges() {
    setPending("changes");
    try {
      const result = await ownerDecide(taskId, "CHANGES_REQUESTED", remark);
      if (result.ok) {
        success("Changes requested — the manager has been notified.");
        setChangesOpen(false);
        router.refresh();
      } else {
        error(result.error ?? "Couldn't record your decision. Check your connection and try again.");
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" fullWidth onClick={() => setChangesOpen(true)} disabled={pending !== null}>
        <Undo2 className="h-4 w-4" /> Request changes
      </Button>
      <Button fullWidth onClick={approve} loading={pending === "approve"} disabled={pending === "changes"}>
        <Check className="h-4 w-4" /> Approve
      </Button>

      <Modal open={changesOpen} onClose={() => setChangesOpen(false)} title="Request changes">
        <FieldGroup>
          <Label htmlFor="owner-remark">What needs to change? (optional)</Label>
          <Textarea id="owner-remark" rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Let the manager know what to fix" />
        </FieldGroup>
        <Button fullWidth loading={pending === "changes"} onClick={requestChanges}>
          Send back for changes
        </Button>
      </Modal>
    </div>
  );
}
