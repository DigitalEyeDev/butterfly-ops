"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { Select, Label, FieldGroup } from "@/components/ui/Field";
import { IconButton, Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/Overlay";
import { FilterChip, FilterChipRow } from "@/components/ui/FilterChips";
import type { Category, Profile } from "@/lib/types";

const CHIPS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "due:today", label: "Today" },
  { key: "due:week", label: "This week" },
  { key: "due:overdue", label: "Overdue" },
  { key: "status:NOT_STARTED", label: "Not started" },
  { key: "status:IN_PROGRESS", label: "In progress" },
  { key: "status:COMPLETED", label: "Completed" },
  { key: "status:AWAITING_APPROVAL", label: "Awaiting approval" },
  { key: "status:APPROVED", label: "Approved" },
];

export function TaskFilterBar({ categories, staff }: { categories: Category[]; staff: Profile[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const currentChip = params.get("status")
    ? `status:${params.get("status")}`
    : params.get("due")
    ? `due:${params.get("due")}`
    : "";

  const pushParams = useCallback(
    (next: URLSearchParams) => {
      const str = next.toString();
      router.push(str ? `${pathname}?${str}` : pathname);
    },
    [pathname, router]
  );

  useEffect(() => {
    if (query === (params.get("q") ?? "")) return;
    const handle = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query) next.set("q", query);
      else next.delete("q");
      pushParams(next);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function setChip(key: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("status");
    next.delete("due");
    if (key.startsWith("status:")) next.set("status", key.slice(7));
    if (key.startsWith("due:")) next.set("due", key.slice(4));
    pushParams(next);
  }

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    pushParams(next);
  }

  const activeAdvanced = ["category", "assignee", "priority"].filter((k) => params.get(k)).length;

  return (
    <div className="mb-4 space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, staff, category…"
            className="pl-9"
          />
        </div>
        <IconButton label="Filters" variant="outline" onClick={() => setFiltersOpen(true)} className="relative shrink-0">
          <SlidersHorizontal className="h-4 w-4" />
          {activeAdvanced > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-brand-foreground">
              {activeAdvanced}
            </span>
          )}
        </IconButton>
      </div>

      <FilterChipRow>
        {CHIPS.map((c) => (
          <FilterChip key={c.key} label={c.label} active={currentChip === c.key} onClick={() => setChip(c.key)} />
        ))}
      </FilterChipRow>

      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <FieldGroup>
          <Label htmlFor="filter-category">Category</Label>
          <Select id="filter-category" value={params.get("category") ?? ""} onChange={(e) => setParam("category", e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="filter-staff">Staff</Label>
          <Select id="filter-staff" value={params.get("assignee") ?? ""} onChange={(e) => setParam("assignee", e.target.value)}>
            <option value="">Everyone</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="filter-priority">Priority</Label>
          <Select id="filter-priority" value={params.get("priority") ?? ""} onChange={(e) => setParam("priority", e.target.value)}>
            <option value="">Any priority</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </Select>
        </FieldGroup>
        <Button fullWidth onClick={() => setFiltersOpen(false)}>
          Show results
        </Button>
      </BottomSheet>
    </div>
  );
}
