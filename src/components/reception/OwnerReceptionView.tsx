"use client";

import { Users, Ticket, Footprints, Star, PartyPopper } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/States";
import { ReceptionReportDetail } from "@/components/reception/ReceptionReportDetail";
import { ReceptionHistoryList } from "@/components/reception/ReceptionHistoryList";
import type { ReceptionReport } from "@/lib/types";

/** View-only — Owner can drill into Reception but only a manager verifies
 * or requests a correction (see the plan's Manager-only rule). */
export function OwnerReceptionView({ report, history }: { report: ReceptionReport | null; history: ReceptionReport[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Visitors" value={report?.visitors_count ?? "—"} icon={Users} tone="info" />
        <MetricCard label="Tickets sold" value={report?.tickets_sold ?? "—"} icon={Ticket} tone="brand" />
        <MetricCard label="Socks sold" value={report?.socks_sold ?? "—"} icon={Footprints} tone="neutral" />
        <MetricCard label="Reviews" value={report?.review_count ?? "—"} icon={Star} tone="warning" />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Today&apos;s report</h2>
        {!report ? (
          <EmptyState icon={PartyPopper} title="Nothing filed yet today" description="The receptionist hasn't started today's report." />
        ) : (
          <ReceptionReportDetail report={report} />
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">History</h2>
        <ReceptionHistoryList reports={history} />
      </div>
    </div>
  );
}
