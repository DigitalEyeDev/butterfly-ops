"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { FilterChip, FilterChipRow } from "@/components/ui/FilterChips";
import { todayInParkTZ } from "@/lib/attendance";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}

export function AttendanceFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const today = todayInParkTZ();
  const yesterday = isoDaysAgo(1);
  const selectedDate = params.get("date") ?? today;

  const pushParams = useCallback(
    (next: URLSearchParams) => {
      const str = next.toString();
      router.push(str ? `${pathname}?${str}` : pathname);
    },
    [pathname, router]
  );

  function setDate(date: string) {
    const next = new URLSearchParams(params.toString());
    if (date === today) next.delete("date");
    else next.set("date", date);
    pushParams(next);
  }

  function submitSearch(value: string) {
    setQuery(value);
    const next = new URLSearchParams(params.toString());
    if (value) next.set("q", value);
    else next.delete("q");
    pushParams(next);
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => submitSearch(e.target.value)}
          placeholder="Search staff…"
          className="pl-9"
        />
      </div>

      <FilterChipRow>
        <FilterChip label="Today" active={selectedDate === today} onClick={() => setDate(today)} />
        <FilterChip label="Yesterday" active={selectedDate === yesterday} onClick={() => setDate(yesterday)} />
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
      </FilterChipRow>
    </div>
  );
}
