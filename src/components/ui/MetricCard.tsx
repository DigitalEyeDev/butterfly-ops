"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const toneClasses: Record<string, string> = {
  neutral: "bg-surface-muted text-foreground",
  brand: "bg-brand-soft text-brand-strong",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
};

const barClasses: Record<string, string> = {
  neutral: "bg-neutral/40",
  brand: "bg-brand",
  danger: "bg-danger",
  warning: "bg-warning",
  success: "bg-success",
  info: "bg-info",
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  onClick,
  active,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: keyof typeof toneClasses;
  onClick?: () => void;
  active?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius-md)] border border-border p-4 text-left shadow-[var(--shadow-card)] transition-all duration-200",
        onClick && "cursor-pointer active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]",
        active ? "ring-2 ring-brand/50 border-brand/40" : "bg-surface"
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100", barClasses[tone])} aria-hidden />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        {Icon && (
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", toneClasses[tone])}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
      <span className="font-display text-[28px] font-bold leading-none tracking-tight">{value}</span>
    </Comp>
  );
}
