// Pure helpers for the one-time Excel/CSV import. Kept dependency-free and
// isomorphic (used by both the client-side preview and the server action)
// so the preview the manager reviews is exactly what gets saved.

import type { TaskPriority, TaskStatus } from "@/lib/types";

export interface RawImportRow {
  legacy_id: string;
  title: string;
  assignedName: string;
  dueDateRaw: string;
  statusRaw: string;
  remarks: string;
}

export interface ParsedImportRow extends RawImportRow {
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  matchedAssigneeName: string | null;
  warnings: string[];
  include: boolean;
}

const STATUS_MAP: Record<string, TaskStatus> = {
  done: "COMPLETED",
  completed: "COMPLETED",
  "in progress": "IN_PROGRESS",
  inprogress: "IN_PROGRESS",
  "in process": "IN_PROGRESS",
  inprocess: "IN_PROGRESS",
  "yet to be started": "NOT_STARTED",
  "yet to start": "NOT_STARTED",
  "not started": "NOT_STARTED",
  pending: "NOT_STARTED",
};

export function normalizeStatus(raw: string): { status: TaskStatus; needsReview: boolean } {
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return { status: "NOT_STARTED", needsReview: true };
  const mapped = STATUS_MAP[key];
  if (mapped) return { status: mapped, needsReview: false };
  return { status: "NOT_STARTED", needsReview: true };
}

/** Accepts d/m/yyyy, d-m-yyyy, yyyy-mm-dd, or a plain "23 Mar 2025" string. */
export function parseDueDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, yRaw] = dmy;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? null : iso;
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return null;
}

export function parseImportRow(
  raw: RawImportRow,
  staff: { id: string; full_name: string }[]
): ParsedImportRow {
  const warnings: string[] = [];
  const { status, needsReview } = normalizeStatus(raw.statusRaw);
  if (needsReview) {
    warnings.push(
      raw.statusRaw.trim() ? `Unrecognized status "${raw.statusRaw}" — set to Not started` : "Status was blank — set to Not started"
    );
  }

  const due_date = raw.dueDateRaw.trim() ? parseDueDate(raw.dueDateRaw) : null;
  if (raw.dueDateRaw.trim() && !due_date) {
    warnings.push(`Couldn't read due date "${raw.dueDateRaw}" — left blank`);
  }

  let assigned_to: string | null = null;
  let matchedAssigneeName: string | null = null;
  const name = raw.assignedName.trim();
  if (name) {
    const match = staff.find((s) => s.full_name.trim().toLowerCase() === name.toLowerCase());
    if (match) {
      assigned_to = match.id;
      matchedAssigneeName = match.full_name;
    } else {
      warnings.push(`"${name}" doesn't match any staff account — left unassigned`);
    }
  }

  return {
    ...raw,
    status,
    priority: "MEDIUM",
    due_date,
    assigned_to,
    matchedAssigneeName,
    warnings,
    include: Boolean(raw.title.trim()),
  };
}
