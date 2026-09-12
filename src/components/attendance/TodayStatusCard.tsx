"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Coffee, LogOut, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ClockActionFlow } from "@/components/attendance/ClockActionFlow";
import { formatClockTime, formatMinutes } from "@/lib/attendance";
import type { AttendanceEventType, AttendanceRecord, Branch } from "@/lib/types";

function useCountdown(targetMs: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (targetMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  return targetMs === null ? null : targetMs - now;
}

export function TodayStatusCard({
  record,
  branch,
}: {
  record: AttendanceRecord | null;
  branch: Pick<Branch, "attendance_lat" | "attendance_lng" | "attendance_radius_m">;
}) {
  const router = useRouter();
  const [activeFlow, setActiveFlow] = useState<AttendanceEventType | null>(null);
  const events = record?.events ?? [];
  const clockIn = events.find((e) => e.event_type === "CLOCK_IN");
  const lunchStart = events.find((e) => e.event_type === "LUNCH_START");
  const lunchEnd = events.find((e) => e.event_type === "LUNCH_END");
  const clockOut = events.find((e) => e.event_type === "CLOCK_OUT");
  const lunchTaken = !!lunchEnd;

  const lunchAllowedMs = (record?.lunch_allowed_minutes ?? 30) * 60000;
  const lunchDeadline = lunchStart ? new Date(lunchStart.event_timestamp).getTime() + lunchAllowedMs : null;
  const remainingMs = useCountdown(record?.status === "ON_LUNCH" ? lunchDeadline : null);

  function close() {
    setActiveFlow(null);
    router.refresh();
  }

  let body: React.ReactNode;

  if (!record || record.status === "NOT_STARTED") {
    body = (
      <>
        <p className="text-lg font-semibold">Ready to start your shift?</p>
        <Button size="lg" fullWidth className="mt-4" onClick={() => setActiveFlow("CLOCK_IN")}>
          <Play className="h-4 w-4" /> Clock in
        </Button>
      </>
    );
  } else if (record.status === "PRESENT" && !clockOut) {
    body = (
      <>
        <p className="text-lg font-semibold">You&apos;re on shift.</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatClockTime(clockIn?.event_timestamp)}</p>
        <p className="text-xs text-muted">Clocked in</p>
        <div className="mt-4 flex gap-2">
          {!lunchTaken && (
            <Button variant="outline" fullWidth onClick={() => setActiveFlow("LUNCH_START")}>
              <Coffee className="h-4 w-4" /> Start lunch
            </Button>
          )}
          <Button fullWidth onClick={() => setActiveFlow("CLOCK_OUT")}>
            <LogOut className="h-4 w-4" /> Clock out
          </Button>
        </div>
      </>
    );
  } else if (record.status === "ON_LUNCH") {
    const exceeded = remainingMs !== null && remainingMs < 0;
    body = (
      <>
        <p className="text-lg font-semibold">{exceeded ? "Lunch time exceeded" : "You're on lunch."}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatClockTime(lunchStart?.event_timestamp)}</p>
        <p className={exceeded ? "text-sm font-semibold text-danger" : "text-sm text-muted"}>
          {remainingMs === null
            ? ""
            : exceeded
            ? `${formatMinutes(Math.abs(remainingMs) / 60000)} over`
            : `${formatCountdown(remainingMs)} remaining`}
        </p>
        <Button size="lg" fullWidth className="mt-4" onClick={() => setActiveFlow("LUNCH_END")}>
          <ArrowRight className="h-4 w-4" /> End lunch
        </Button>
      </>
    );
  } else {
    // CLOCKED_OUT
    const shiftMs =
      clockIn && clockOut ? new Date(clockOut.event_timestamp).getTime() - new Date(clockIn.event_timestamp).getTime() : 0;
    const lunchMs =
      lunchStart && lunchEnd ? new Date(lunchEnd.event_timestamp).getTime() - new Date(lunchStart.event_timestamp).getTime() : 0;
    const netMinutes = shiftMs / 60000 - lunchMs / 60000;
    body = (
      <>
        <p className="text-lg font-semibold">Shift completed</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted">Net time</p>
        <p className="text-3xl font-bold tabular-nums">{formatMinutes(netMinutes)}</p>
      </>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 text-center shadow-[var(--shadow-card)]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Today</p>
      {body}

      {activeFlow && (
        <ClockActionFlow eventType={activeFlow} open={!!activeFlow} onClose={close} branch={branch} />
      )}
    </div>
  );
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
