"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DropdownOption {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

export function Dropdown({ trigger, options }: { trigger: React.ReactNode; options: DropdownOption[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-[var(--radius-sm)] border border-border bg-surface py-1 shadow-[var(--shadow-pop)] animate-fade-in">
          {options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                setOpen(false);
                opt.onSelect();
              }}
              className={cn(
                "block w-full px-3.5 py-2.5 text-left text-sm font-medium hover:bg-surface-muted",
                opt.destructive ? "text-danger" : "text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
