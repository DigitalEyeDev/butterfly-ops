// Pure attendance math — shared by server queries and client components so
// the numbers shown always agree. Nothing here is authoritative: the
// server (record_attendance_event) is the only place that decides what
// actually happened; this file just presents what's already stored.

import type { AttendanceEvent, AttendanceEventType, AttendanceRecord, Branch, LocationStatus } from "@/lib/types";

const PARK_TZ = "Asia/Kolkata";

/** Client-side Haversine preview only — the server recomputes this itself
 * from the raw lat/lng before trusting any distance figure. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export function formatMinutes(totalMinutes: number | null): string {
  if (totalMinutes === null || Number.isNaN(totalMinutes)) return "—";
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.round(Math.abs(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  return `${sign}${h}h ${m}m`;
}

export function formatClockTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: PARK_TZ, hour: "numeric", minute: "2-digit" });
}

export function formatAttendanceDate(dateStr: string): string {
  // attendance_date is a plain YYYY-MM-DD, not a timestamp — parse it as a
  // local calendar date so it doesn't shift a day under UTC parsing.
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function todayInParkTZ(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: PARK_TZ }); // en-CA => YYYY-MM-DD
}

function findEvent(events: AttendanceEvent[], type: AttendanceEventType): AttendanceEvent | undefined {
  return events.find((e) => e.event_type === type);
}

function minutesBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

/** [hour, minute] of an ISO timestamp as displayed in Asia/Kolkata. */
function timeOfDayInParkTZ(iso: string): [number, number] {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PARK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return [hour, minute];
}

export interface ShiftSummary {
  clockIn?: AttendanceEvent;
  lunchStart?: AttendanceEvent;
  lunchEnd?: AttendanceEvent;
  clockOut?: AttendanceEvent;
  shiftMinutes: number | null;
  lunchMinutes: number | null;
  lunchOverageMinutes: number;
  netMinutes: number | null;
  expectedMinutes: number;
  differenceMinutes: number | null;
  isLunchOngoing: boolean;
  isShiftOngoing: boolean;
}

/** The single place that turns a record + its events into every number the
 * UI shows. `nowIso` is injected so server components can pass a real
 * server-generated "now" rather than relying on the client clock. */
export function computeShiftSummary(record: AttendanceRecord, events: AttendanceEvent[], nowIso: string): ShiftSummary {
  const clockIn = findEvent(events, "CLOCK_IN");
  const lunchStart = findEvent(events, "LUNCH_START");
  const lunchEnd = findEvent(events, "LUNCH_END");
  const clockOut = findEvent(events, "CLOCK_OUT");

  const isLunchOngoing = !!lunchStart && !lunchEnd;
  const isShiftOngoing = !!clockIn && !clockOut;

  // "Still open" is read from the record's status, not just "event
  // missing" — a manager can adjust status to CLOCKED_OUT without a real
  // CLOCK_OUT event (see manager_adjust_attendance). Falling back to
  // `nowIso` in that case would make the shift/net duration grow forever
  // on a day that's supposedly closed, so it resolves to "unknown" (null)
  // instead of a fabricated live estimate.
  const shiftEndTs = clockOut?.event_timestamp ?? (record.status === "PRESENT" || record.status === "ON_LUNCH" ? nowIso : null);
  const lunchEndTs = lunchEnd?.event_timestamp ?? (record.status === "ON_LUNCH" ? nowIso : null);

  const shiftMinutes = clockIn && shiftEndTs ? minutesBetween(clockIn.event_timestamp, shiftEndTs) : null;
  // No lunch taken at all -> 0 minutes (a true, known value). Lunch
  // started but its end is unknowable (not currently on lunch, and no
  // real LUNCH_END event) -> null, same "unknown" reasoning as shiftMinutes.
  const lunchMinutes = !lunchStart ? 0 : lunchEndTs ? minutesBetween(lunchStart.event_timestamp, lunchEndTs) : null;

  const lunchOverageMinutes = Math.max(0, (lunchMinutes ?? 0) - record.lunch_allowed_minutes);
  const netMinutes = shiftMinutes !== null ? shiftMinutes - (lunchMinutes ?? 0) : null;
  const differenceMinutes = netMinutes !== null && clockOut ? netMinutes - record.expected_shift_minutes : null;

  return {
    clockIn,
    lunchStart,
    lunchEnd,
    clockOut,
    shiftMinutes,
    lunchMinutes,
    lunchOverageMinutes,
    netMinutes,
    expectedMinutes: record.expected_shift_minutes,
    differenceMinutes,
    isLunchOngoing,
    isShiftOngoing,
  };
}

export type AttendanceException =
  | { kind: "LATE_ARRIVAL"; minutesLate: number }
  | { kind: "LUNCH_EXCEEDED"; overageMinutes: number }
  | { kind: "MISSING_CLOCK_OUT" }
  | { kind: "LOCATION_ISSUE"; status: LocationStatus; eventLabel: string };

const NON_VERIFIED: LocationStatus[] = [
  "OUTSIDE_ZONE",
  "LOCATION_UNCERTAIN",
  "LOCATION_PERMISSION_DENIED",
  "LOCATION_UNAVAILABLE",
];

const EVENT_LABEL: Record<AttendanceEventType, string> = {
  CLOCK_IN: "Clock-in",
  LUNCH_START: "Lunch start",
  LUNCH_END: "Lunch end",
  CLOCK_OUT: "Clock-out",
};

/** Every exception is derived here, never stored — see the note at the top
 * of supabase/attendance.sql on why status stays a small, fixed set. */
export function computeExceptions(
  record: AttendanceRecord,
  events: AttendanceEvent[],
  branch: Pick<Branch, "expected_start_time">,
  isPastDay: boolean
): AttendanceException[] {
  const exceptions: AttendanceException[] = [];
  const clockIn = findEvent(events, "CLOCK_IN");
  const lunchStart = findEvent(events, "LUNCH_START");
  const lunchEnd = findEvent(events, "LUNCH_END");
  const clockOut = findEvent(events, "CLOCK_OUT");

  if (clockIn) {
    const [expectedH, expectedM] = branch.expected_start_time.split(":").map(Number);
    const [actualH, actualM] = timeOfDayInParkTZ(clockIn.event_timestamp);
    const minutesLate = actualH * 60 + actualM - (expectedH * 60 + expectedM);
    if (minutesLate > 5) exceptions.push({ kind: "LATE_ARRIVAL", minutesLate: Math.round(minutesLate) });
  }

  if (lunchStart) {
    const lunchMinutes = minutesBetween(lunchStart.event_timestamp, (lunchEnd ?? { event_timestamp: new Date().toISOString() }).event_timestamp);
    const overage = lunchMinutes - record.lunch_allowed_minutes;
    if (overage > 0) exceptions.push({ kind: "LUNCH_EXCEEDED", overageMinutes: Math.round(overage) });
  }

  if (isPastDay && clockIn && !clockOut) {
    exceptions.push({ kind: "MISSING_CLOCK_OUT" });
  }

  for (const event of [clockIn, lunchStart, lunchEnd, clockOut]) {
    if (event && NON_VERIFIED.includes(event.location_status)) {
      exceptions.push({ kind: "LOCATION_ISSUE", status: event.location_status, eventLabel: EVENT_LABEL[event.event_type] });
    }
  }

  return exceptions;
}
