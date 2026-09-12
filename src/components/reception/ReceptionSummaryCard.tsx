"use client";

import { Users, Ticket, Footprints, Star } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { ReceptionStatusBadge } from "@/components/ui/Badge";
import type { ReceptionReport } from "@/lib/types";

/**
 * Compact Reception summary embedded in the manager/owner dashboards.
 * A "use client" wrapper is required here — MetricCard is itself a client
 * component, and passing a Lucide icon *component reference* as a prop
 * into it from a Server Component fails serialization (the exact bug hit
 * earlier with MetricGrid/OverviewSummary), so the icons are looked up
 * inside this client boundary rather than passed in from a server page.
 */
export function ReceptionSummaryCard({ report, condensed }: { report: ReceptionReport | null; condensed?: boolean }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      {!condensed && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-muted">{report ? "Today's numbers" : "Nothing filed yet today"}</p>
          {report && <ReceptionStatusBadge status={report.status} />}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Visitors" value={report?.visitors_count ?? "—"} icon={Users} tone="info" />
        <MetricCard label="Tickets" value={report?.tickets_sold ?? "—"} icon={Ticket} tone="brand" />
        <MetricCard label="Socks" value={report?.socks_sold ?? "—"} icon={Footprints} tone="neutral" />
        <MetricCard label="Reviews" value={report?.review_count ?? "—"} icon={Star} tone="warning" />
      </div>
    </div>
  );
}
