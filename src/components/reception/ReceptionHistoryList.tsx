import { FileText } from "lucide-react";
import { formatAttendanceDate } from "@/lib/attendance";
import { ReceptionStatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import type { ReceptionReport } from "@/lib/types";

/**
 * `business_date` is a plain YYYY-MM-DD (not a timestamp) — reuses
 * formatAttendanceDate from lib/attendance.ts, which already parses that
 * shape as a local calendar date rather than risking a day-shift under UTC
 * parsing (the same class of bug already fixed once for attendance dates).
 */
export function ReceptionHistoryList({ reports }: { reports: ReceptionReport[] }) {
  if (reports.length === 0) {
    return <EmptyState icon={FileText} title="No reports yet" description="Daily reports will show up here." />;
  }

  return (
    <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface">
      {reports.map((report) => (
        <li key={report.id} className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">{formatAttendanceDate(report.business_date)}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              <span>{report.visitors_count ?? "—"} visitors</span>
              <span>{report.tickets_sold ?? "—"} tickets</span>
              <span>{report.socks_sold ?? "—"} socks</span>
              <span>{report.review_count ?? "—"} reviews</span>
            </div>
          </div>
          <ReceptionStatusBadge status={report.status} />
        </li>
      ))}
    </ul>
  );
}
