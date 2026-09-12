"use client";

import { Users, CheckCircle2, Coffee, LogOut, Clock, AlertTriangle } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import type { AttendanceRecord } from "@/lib/types";

export function computeOverviewCounts(records: AttendanceRecord[]) {
  let present = 0,
    onLunch = 0,
    notClockedIn = 0,
    clockedOut = 0;

  for (const r of records) {
    if (r.status === "NOT_STARTED") notClockedIn++;
    else if (r.status === "ON_LUNCH") onLunch++;
    else if (r.status === "CLOCKED_OUT") clockedOut++;
    else present++;
  }

  return { total: records.length, present: present + onLunch, onLunch, notClockedIn, clockedOut };
}

export function OverviewSummary({ records, exceptionCount }: { records: AttendanceRecord[]; exceptionCount: number }) {
  const counts = computeOverviewCounts(records);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <MetricCard label="Total staff" value={counts.total} icon={Users} tone="neutral" />
      <MetricCard label="Present" value={counts.present} icon={CheckCircle2} tone="success" />
      <MetricCard label="On lunch" value={counts.onLunch} icon={Coffee} tone="warning" />
      <MetricCard label="Not clocked in" value={counts.notClockedIn} icon={Clock} tone="neutral" />
      <MetricCard label="Clocked out" value={counts.clockedOut} icon={LogOut} tone="brand" />
      <MetricCard label="Exceptions" value={exceptionCount} icon={AlertTriangle} tone={exceptionCount > 0 ? "danger" : "neutral"} />
    </div>
  );
}
