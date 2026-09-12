"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Send, AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label, FieldGroup, FieldError } from "@/components/ui/Field";
import { ReceptionStatusBadge } from "@/components/ui/Badge";
import { EvidenceUploader } from "@/components/reception/EvidenceUploader";
import { ReceptionHistoryList } from "@/components/reception/ReceptionHistoryList";
import { useToast } from "@/components/ui/Toast";
import { saveReceptionDraft, submitReceptionReport } from "@/lib/actions/reception";
import { formatDateTime } from "@/lib/utils";
import type { ReceptionReport } from "@/lib/types";

export function ReceptionistView({ report, history }: { report: ReceptionReport | null; history: ReceptionReport[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();

  const editable = !report || report.status === "DRAFT" || report.status === "CORRECTION_REQUESTED";
  const reviewsReported = (report?.review_count ?? 0) > 0;
  const hasEvidence = (report?.evidence?.length ?? 0) > 0;

  async function handleSave(formData: FormData) {
    setSaving(true);
    setFieldError(undefined);
    try {
      const result = await saveReceptionDraft(formData);
      if (result.ok) {
        success("Draft saved.");
        router.refresh();
      } else {
        setFieldError(result.error);
      }
    } finally {
      setSaving(false);
    }
  }

  // Submit always saves the current form values first — so a receptionist
  // who edited a number and clicked "Submit" without clicking "Save draft"
  // first can never accidentally submit stale data. The RPC still
  // re-validates completeness/evidence server-side regardless.
  async function handleSubmit() {
    if (!formRef.current) return;
    setSubmitting(true);
    setFieldError(undefined);
    try {
      const fd = new FormData(formRef.current);
      const saveResult = await saveReceptionDraft(fd);
      if (!saveResult.ok || !saveResult.reportId) {
        error(saveResult.error ?? "Couldn't save this report.");
        return;
      }
      const submitResult = await submitReceptionReport(saveResult.reportId);
      if (submitResult.ok) {
        success("Today's report submitted.");
        router.refresh();
      } else {
        error(submitResult.error ?? "Couldn't submit this report.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {report && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <div>
            <p className="text-sm font-semibold">Today&apos;s report</p>
            {report.status === "SUBMITTED" && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <Clock3 className="h-3.5 w-3.5" /> Submitted {formatDateTime(report.submitted_at)} — awaiting manager review
              </p>
            )}
            {report.status === "VERIFIED" && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Verified by {report.reviewer?.full_name ?? "a manager"} · {formatDateTime(report.reviewed_at)}
              </p>
            )}
            {report.status === "CORRECTION_REQUESTED" && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> Correction requested — edit and resubmit
              </p>
            )}
            {report.status === "DRAFT" && <p className="mt-0.5 text-xs text-muted">Not submitted yet</p>}
          </div>
          <ReceptionStatusBadge status={report.status} />
        </div>
      )}

      {report?.status === "CORRECTION_REQUESTED" && report.correction_reason && (
        <div className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
          <p className="font-semibold">What needs fixing</p>
          <p className="mt-1">{report.correction_reason}</p>
        </div>
      )}

      {/* Keyed by updated_at so a status change (e.g. a correction request
          or a fresh day) remounts the form and its uncontrolled inputs pick
          up the new defaultValue rather than showing stale typed text. */}
      <form
        key={report?.updated_at ?? "new"}
        ref={formRef}
        action={handleSave}
        className="rounded-[var(--radius-md)] border border-border bg-surface p-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup className="mb-0">
            <Label htmlFor="visitors_count" required>
              Visitors
            </Label>
            <Input
              id="visitors_count"
              name="visitors_count"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={report?.visitors_count ?? ""}
              disabled={!editable}
            />
          </FieldGroup>
          <FieldGroup className="mb-0">
            <Label htmlFor="tickets_sold" required>
              Tickets sold
            </Label>
            <Input
              id="tickets_sold"
              name="tickets_sold"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={report?.tickets_sold ?? ""}
              disabled={!editable}
            />
          </FieldGroup>
          <FieldGroup className="mb-0">
            <Label htmlFor="socks_sold" required>
              Socks sold
            </Label>
            <Input
              id="socks_sold"
              name="socks_sold"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={report?.socks_sold ?? ""}
              disabled={!editable}
            />
          </FieldGroup>
          <FieldGroup className="mb-0">
            <Label htmlFor="review_count" required>
              Reviews
            </Label>
            <Input
              id="review_count"
              name="review_count"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={report?.review_count ?? ""}
              disabled={!editable}
            />
          </FieldGroup>
        </div>

        <FieldGroup className="mb-0 mt-4">
          <Label htmlFor="remarks">Remarks</Label>
          <Textarea
            id="remarks"
            name="remarks"
            rows={3}
            defaultValue={report?.remarks ?? ""}
            disabled={!editable}
            placeholder="Anything management should know about today"
          />
        </FieldGroup>

        {fieldError && <FieldError>{fieldError}</FieldError>}

        {editable && (
          <Button type="submit" variant="outline" fullWidth loading={saving} className="mt-4">
            <Save className="h-4 w-4" /> Save draft
          </Button>
        )}
      </form>

      {report && (
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-semibold">
            Review evidence{" "}
            {reviewsReported && editable && <span className="font-normal text-warning">— required since reviews &gt; 0</span>}
          </p>
          <EvidenceUploader reportId={report.id} evidence={report.evidence ?? []} editable={editable} />
        </div>
      )}

      {editable && (
        <div>
          <Button fullWidth size="lg" loading={submitting} onClick={handleSubmit}>
            <Send className="h-4 w-4" /> Submit today&apos;s report
          </Button>
          {reviewsReported && !hasEvidence && (
            <p className="mt-2 text-center text-xs text-warning">
              Attach at least one evidence photo for the reported reviews before submitting.
            </p>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">History</h2>
        <ReceptionHistoryList reports={history} />
      </div>
    </div>
  );
}
