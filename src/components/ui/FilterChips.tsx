"use client";

import { cn } from "@/lib/utils";

export function FilterChip({
  label,
  active,
  onClick,
  onClear,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  onClear?: () => void;
}) {
  return (
    <button
      onClick={onClear ?? onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-brand bg-brand-soft text-brand-strong"
          : "border-border bg-surface text-muted hover:text-foreground"
      )}
    >
      {label}
      {active && onClear && <span className="ml-0.5 text-brand-strong">×</span>}
    </button>
  );
}

export function FilterChipRow({ children }: { children: React.ReactNode }) {
  return <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">{children}</div>;
}
