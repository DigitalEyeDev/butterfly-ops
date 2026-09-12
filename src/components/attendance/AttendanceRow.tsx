import Link from "next/link";
import { MapPin, MapPinOff, AlertTriangle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { computeShiftSummary, computeExceptions, formatClockTime, formatMinutes } from "@/lib/attendance";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/types";
import type { AttendanceRecord, Branch } from "@/lib/types";

const STATUS_TONE: Record<string, string> = {
  NOT_STARTED: "bg-neutral-soft text-neutral",
  PRESENT: "bg-success-soft text-success",
  ON_LUNCH: "bg-warning-soft text-warning",
  CLOCKED_OUT: "bg-brand-soft text-brand-strong",
};

export function AttendanceRow({
  record,
  branch,
  isPastDay,
}: {
  record: AttendanceRecord;
  branch: Pick<Branch, "expected_start_time">;
  isPastDay: boolean;
}) {
  const events = record.events ?? [];
  const summary = computeShiftSummary(record, events, new Date().toISOString());
  const exceptions = record.id.startsWith("placeholder-") ? [] : computeExceptions(record, events, branch, isPastDay);
  const anyLocationVerified = events.some((e) => e.location_status === "VERIFIED");
  const anyLocationIssue = exceptions.some((e) => e.kind === "LOCATION_ISSUE");
  const isPlaceholder = record.id.startsWith("placeholder-");

  const content = (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-md)] border bg-surface p-4 shadow-[var(--shadow-card)] transition-all duration-200",
        !isPlaceholder && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]",
        exceptions.length > 0 ? "border-warning/40" : "border-border"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={record.user?.full_name ?? "?"} />
          <p className="truncate font-semibold">{record.user?.full_name}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_TONE[record.status])}>
          {ATTENDANCE_STATUS_LABELS[record.status]}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <Field label="Clock in" value={formatClockTime(summary.clockIn?.event_timestamp)} />
        <Field label="Lunch" value={summary.lunchStart ? formatMinutes(summary.lunchMinutes) : "—"} />
        <Field label="Clock out" value={formatClockTime(summary.clockOut?.event_timestamp)} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted">
          {anyLocationIssue ? (
            <MapPinOff className="h-3.5 w-3.5 text-warning" />
          ) : anyLocationVerified ? (
            <MapPin className="h-3.5 w-3.5 text-success" />
          ) : null}
          {anyLocationIssue ? "Location issue" : anyLocationVerified ? "Verified" : "—"}
        </span>
        <span className="font-semibold tabular-nums">Net {formatMinutes(summary.netMinutes)}</span>
      </div>

      {exceptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {exceptions.map((exc, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
              <AlertTriangle className="h-3 w-3" />
              {exceptionLabel(exc)}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  if (isPlaceholder) return content;
  return <Link href={`/attendance/${record.id}`}>{content}</Link>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

function exceptionLabel(exc: ReturnType<typeof computeExceptions>[number]): string {
  switch (exc.kind) {
    case "LATE_ARRIVAL":
      return `${exc.minutesLate}m late`;
    case "LUNCH_EXCEEDED":
      return `Lunch +${exc.overageMinutes}m`;
    case "MISSING_CLOCK_OUT":
      return "Missing clock-out";
    case "LOCATION_ISSUE":
      return `${exc.eventLabel}: location`;
  }
}
