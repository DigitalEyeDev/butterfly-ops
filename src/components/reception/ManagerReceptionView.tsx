"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Ticket, Footprints, Star, PartyPopper } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { ReceptionReportDetail } from "@/components/reception/ReceptionReportDetail";
import { ReceptionHistoryList } from "@/components/reception/ReceptionHistoryList";
import { RequestCorrectionDialog } from "@/components/reception/RequestCorrectionDialog";
import { verifyReceptionReport, requestReceptionCorrection } from "@/lib/actions/reception";
import type { ReceptionReport } from "@/lib/types";

export function ManagerReceptionView({ report, history }: { report: ReceptionReport | null; history: ReceptionReport[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [verifying, setVerifying] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleVerify() {
    if (!report) return;
    setVerifying(true);
    startTransition(async () => {
      try {
        const result = await verifyReceptionReport(report.id);
        if (result.ok) {
          success("Report verified.");
          router.refresh();
        } else {
          error(result.error ?? "Couldn't verify this report.");
        }
      } finally {
        setVerifying(false);
      }
    });
  }

  async function handleRequestCorrection(reason: string) {
    if (!report) return { ok: false, error: "No report to correct." };
    const fd = new FormData();
    fd.set("reason", reason);
    const result = await requestReceptionCorrection(report.id, fd);
    if (result.ok) {
      success("Correction requested.");
      router.refresh();
    }
    return result;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Visitors" value={report?.visitors_count ?? "—"} icon={Users} tone="info" />
        <MetricCard label="Tickets sold" value={report?.tickets_sold ?? "—"} icon={Ticket} tone="brand" />
        <MetricCard label="Socks sold" value={report?.socks_sold ?? "—"} icon={Footprints} tone="neutral" />
        <MetricCard label="Reviews" value={report?.review_count ?? "—"} icon={Star} tone="warning" />
        <MetricCard
          label="Evidence"
          value={report ? (report.evidence?.length ?? 0) : "—"}
          tone={report && (report.evidence?.length ?? 0) > 0 ? "success" : "neutral"}
        />
        <MetricCard
          label="Status"
          value={report ? report.status.replace("_", " ") : "No report"}
          tone={report?.status === "VERIFIED" ? "success" : report?.status === "CORRECTION_REQUESTED" ? "warning" : "neutral"}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Today&apos;s report</h2>
        {!report ? (
          <EmptyState icon={PartyPopper} title="Nothing filed yet today" description="The receptionist hasn't started today's report." />
        ) : (
          <ReceptionReportDetail
            report={report}
            actions={
              report.status === "SUBMITTED" ? (
                <>
                  <Button fullWidth loading={verifying} onClick={handleVerify}>
                    Verify
                  </Button>
                  <Button variant="outline" fullWidth onClick={() => setCorrectionOpen(true)}>
                    Request correction
                  </Button>
                </>
              ) : undefined
            }
          />
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">History</h2>
        <ReceptionHistoryList reports={history} />
      </div>

      <RequestCorrectionDialog open={correctionOpen} onClose={() => setCorrectionOpen(false)} onConfirm={handleRequestCorrection} />
    </div>
  );
}
