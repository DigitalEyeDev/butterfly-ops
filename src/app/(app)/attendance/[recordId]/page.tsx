import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getAttendanceRecord, getAttendanceAdjustments, getBranch } from "@/lib/queries";
import { computeShiftSummary, computeExceptions, formatAttendanceDate, formatMinutes, formatClockTime, todayInParkTZ } from "@/lib/attendance";
import { AttendanceTimeline } from "@/components/attendance/AttendanceTimeline";
import { AdjustAttendanceForm } from "@/components/attendance/AdjustAttendanceForm";
import { Avatar } from "@/components/ui/Avatar";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AttendanceDetailPage({ params }: { params: Promise<{ recordId: string }> }) {
  const profile = await requireRole("manager", "owner");
  const { recordId } = await params;

  const record = await getAttendanceRecord(recordId);
  if (!record) notFound();

  const branch = await getBranch(profile.branch_id);
  const events = record.events ?? [];
  const summary = computeShiftSummary(record, events, new Date().toISOString());
  const isPastDay = record.attendance_date < todayInParkTZ();
  const exceptions = computeExceptions(record, events, { expected_start_time: branch?.expected_start_time ?? "10:00" }, isPastDay);
  const adjustments = profile.role === "manager" ? await getAttendanceAdjustments(recordId) : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/attendance" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={record.user?.full_name ?? "?"} size="lg" />
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">{record.user?.full_name}</h1>
            <p className="text-sm text-muted">{formatAttendanceDate(record.attendance_date)}</p>
          </div>
        </div>
        {profile.role === "manager" && <AdjustAttendanceForm recordId={record.id} currentStatus={record.status} />}
      </header>

      {exceptions.length > 0 && (
        <section className="mb-6 rounded-[var(--radius-md)] border border-warning-soft bg-warning-soft/40 p-4">
          <p className="mb-1 text-sm font-semibold text-warning">Attendance exceptions</p>
          <ul className="space-y-1 text-sm text-foreground">
            {exceptions.map((exc, i) => (
              <li key={i}>{describeException(exc)}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6 grid grid-cols-2 gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-4 sm:grid-cols-3">
        <Meta label="Status">{ATTENDANCE_STATUS_LABELS[record.status]}</Meta>
        <Meta label="Expected">{formatMinutes(record.expected_shift_minutes)}</Meta>
        <Meta label="Shift duration">{formatMinutes(summary.shiftMinutes)}</Meta>
        <Meta label="Lunch">{formatMinutes(summary.lunchMinutes)}</Meta>
        <Meta label="Lunch over">{summary.lunchOverageMinutes > 0 ? formatMinutes(summary.lunchOverageMinutes) : "—"}</Meta>
        <Meta label="Net attendance">{formatMinutes(summary.netMinutes)}</Meta>
        <Meta label="Difference">
          {summary.differenceMinutes === null
            ? "—"
            : `${summary.differenceMinutes >= 0 ? "+" : ""}${formatMinutes(summary.differenceMinutes)}`}
        </Meta>
      </section>

      <section className="mb-6">
        <p className="mb-2 text-xs font-medium text-muted">
          Calculated from verified clock events below — not continuous GPS tracking.
        </p>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Timeline</h2>
        <AttendanceTimeline events={events} />
      </section>

      {profile.role === "manager" && adjustments.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Adjustment history</h2>
          <ul className="space-y-3">
            {adjustments.map((a) => (
              <li key={a.id} className="rounded-[var(--radius-sm)] border border-border bg-surface-muted p-3 text-sm">
                <p className="font-medium">
                  {a.previous_status ? ATTENDANCE_STATUS_LABELS[a.previous_status] : "—"} → {a.new_status ? ATTENDANCE_STATUS_LABELS[a.new_status] : "—"}
                </p>
                <p className="mt-0.5 text-muted">&ldquo;{a.reason}&rdquo;</p>
                <p className="mt-0.5 text-xs text-muted">
                  {a.performer?.full_name} · {formatClockTime(a.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

function describeException(exc: ReturnType<typeof computeExceptions>[number]): string {
  switch (exc.kind) {
    case "LATE_ARRIVAL":
      return `Clocked in ${exc.minutesLate}m late`;
    case "LUNCH_EXCEEDED":
      return `Lunch exceeded by ${exc.overageMinutes}m`;
    case "MISSING_CLOCK_OUT":
      return "Missing clock-out";
    case "LOCATION_ISSUE":
      return `${exc.eventLabel}: location not verified`;
  }
}
