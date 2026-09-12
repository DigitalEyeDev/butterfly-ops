"use client";

import Link from "next/link";
import { CheckCircle2, ListTodo, Loader2, AlertTriangle, Hourglass, LayoutGrid } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import type { DashboardMetrics } from "@/lib/queries";

type MetricKey = "total" | "completed" | "inProgress" | "notStarted" | "overdue" | "awaitingApproval";

const ALL_KEYS: MetricKey[] = ["total", "completed", "inProgress", "notStarted", "overdue", "awaitingApproval"];

export function MetricGrid({
  metrics,
  base = "/tasks",
  interactive = true,
  show = ALL_KEYS,
}: {
  metrics: DashboardMetrics;
  base?: string;
  interactive?: boolean;
  show?: MetricKey[];
}) {
  const cardMap: Record<MetricKey, { label: string; value: number; icon: React.ComponentProps<typeof MetricCard>["icon"]; tone: React.ComponentProps<typeof MetricCard>["tone"]; href: string }> = {
    total: { label: "Total tasks", value: metrics.total, icon: LayoutGrid, tone: "neutral", href: base },
    completed: { label: "Completed", value: metrics.completed, icon: CheckCircle2, tone: "success", href: `${base}?status=COMPLETED` },
    inProgress: { label: "In progress", value: metrics.inProgress, icon: Loader2, tone: "info", href: `${base}?status=IN_PROGRESS` },
    notStarted: { label: "Not started", value: metrics.notStarted, icon: ListTodo, tone: "neutral", href: `${base}?status=NOT_STARTED` },
    overdue: { label: "Overdue", value: metrics.overdue, icon: AlertTriangle, tone: "danger", href: `${base}?due=overdue` },
    awaitingApproval: { label: "Awaiting approval", value: metrics.awaitingApproval, icon: Hourglass, tone: "warning", href: `${base}?status=AWAITING_APPROVAL` },
  };

  const cards = show.map((k) => cardMap[k]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) =>
        interactive ? (
          <Link key={c.label} href={c.href} className="contents">
            <MetricCard label={c.label} value={c.value} icon={c.icon} tone={c.tone} />
          </Link>
        ) : (
          <MetricCard key={c.label} label={c.label} value={c.value} icon={c.icon} tone={c.tone} />
        )
      )}
    </div>
  );
}
