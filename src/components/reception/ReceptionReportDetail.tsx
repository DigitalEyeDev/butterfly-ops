import { formatDateTime } from "@/lib/utils";
import { formatAttendanceDate } from "@/lib/attendance";
import { ReceptionStatusBadge } from "@/components/ui/Badge";
import { EvidenceUploader } from "@/components/reception/EvidenceUploader";
import type { ReceptionReport } from "@/lib/types";

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

/** Read-only report detail shared by the manager and owner Reception views
 * — evidence is always non-editable here (only the receptionist can
 * attach/remove, while a report is still DRAFT/CORRECTION_REQUESTED). */
export function ReceptionReportDetail({ report, actions }: { report: ReceptionReport; actions?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{formatAttendanceDate(report.business_date)}</p>
          <p className="text-xs text-muted">
            {report.submitted_by
              ? `Submitted by ${report.submitter?.full_name ?? "—"} · ${formatDateTime(report.submitted_at)}`
              : `Created by ${report.creator?.full_name ?? "—"}`}
          </p>
        </div>
        <ReceptionStatusBadge status={report.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Visitors" value={report.visitors_count ?? "—"} />
        <Field label="Tickets sold" value={report.tickets_sold ?? "—"} />
        <Field label="Socks sold" value={report.socks_sold ?? "—"} />
        <Field label="Reviews" value={report.review_count ?? "—"} />
      </div>

      {report.remarks && (
        <div className="mt-4 rounded-[var(--radius-sm)] bg-surface-muted p-3 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Remarks</p>
          <p className="mt-0.5">{report.remarks}</p>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">Review evidence</p>
        <EvidenceUploader reportId={report.id} evidence={report.evidence ?? []} editable={false} />
      </div>

      {report.status === "CORRECTION_REQUESTED" && report.correction_reason && (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          <p className="font-semibold">Correction requested</p>
          <p className="mt-0.5">{report.correction_reason}</p>
        </div>
      )}

      {report.status === "VERIFIED" && (
        <p className="mt-4 text-xs text-success">
          Verified by {report.reviewer?.full_name ?? "a manager"} · {formatDateTime(report.reviewed_at)}
        </p>
      )}

      {actions && <div className="mt-4 flex gap-2">{actions}</div>}
    </div>
  );
}
