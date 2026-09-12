import { CheckCircle2, AlertTriangle, Circle } from "lucide-react";
import { computeShiftSummary, todayInParkTZ } from "@/lib/attendance";
import { formatAttendanceDate, formatMinutes } from "@/lib/attendance";
import { EmptyState } from "@/components/ui/States";
import type { AttendanceRecord } from "@/lib/types";

export function MyHistoryList({ records }: { records: AttendanceRecord[] }) {
  if (records.length === 0) {
    return <EmptyState icon={Circle} title="No attendance history yet" description="Your clock-ins will show up here." />;
  }

  const today = todayInParkTZ();

  return (
    <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface">
      {records.map((record) => {
        const events = record.events ?? [];
        const now = new Date().toISOString();
        const summary = computeShiftSummary(record, events, now);
        const lunchExceeded = summary.lunchOverageMinutes > 0;
        const isPastDay = record.attendance_date < today;
        const missingClockOut = isPastDay && record.status !== "NOT_STARTED" && record.status !== "CLOCKED_OUT";

        return (
          <li key={record.id} className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">{formatAttendanceDate(record.attendance_date)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm">
                {missingClockOut ? (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" /> Missing clock-out
                  </span>
                ) : lunchExceeded ? (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" /> Lunch exceeded
                  </span>
                ) : record.status === "CLOCKED_OUT" ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Present
                  </span>
                ) : (
                  <span className="text-muted">In progress</span>
                )}
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums">{formatMinutes(summary.netMinutes)}</p>
          </li>
        );
      })}
    </ul>
  );
}
