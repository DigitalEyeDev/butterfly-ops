"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import Link from "next/link";
import { Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select, Label, FieldGroup } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { parseImportRow, type ParsedImportRow, type RawImportRow } from "@/lib/import";
import { importTasks } from "@/lib/actions/import";
import { STATUS_LABELS } from "@/lib/types";
import type { Profile } from "@/lib/types";

type FieldKey = "legacy_id" | "title" | "assignedName" | "dueDateRaw" | "statusRaw" | "remarks";

const FIELD_LABELS: Record<FieldKey, string> = {
  legacy_id: "ID",
  title: "Task (required)",
  assignedName: "Assigned to",
  dueDateRaw: "Due by date",
  statusRaw: "Status",
  remarks: "Remarks",
};

const FIELD_GUESSES: Record<FieldKey, string[]> = {
  legacy_id: ["id"],
  title: ["task", "title", "task title"],
  assignedName: ["assigned to", "assigned", "assignee", "staff"],
  dueDateRaw: ["due by date", "due date", "due"],
  statusRaw: ["status"],
  remarks: ["remarks", "remark", "notes"],
};

function guessColumn(headers: string[], field: FieldKey): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const guess of FIELD_GUESSES[field]) {
    const idx = normalized.indexOf(guess);
    if (idx !== -1) return idx;
  }
  return -1;
}

export function ImportWizard({ staff }: { staff: Profile[] }) {
  const { error } = useToast();
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>({
    legacy_id: -1,
    title: -1,
    assignedName: -1,
    dueDateRaw: -1,
    statusRaw: -1,
    remarks: -1,
  });
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as string[][];
        if (data.length < 2) {
          error("This file doesn't have any data rows.");
          return;
        }
        const [head, ...body] = data;
        setHeaders(head);
        setRows(body);
        const nextMapping = { ...mapping };
        (Object.keys(FIELD_LABELS) as FieldKey[]).forEach((f) => {
          nextMapping[f] = guessColumn(head, f);
        });
        setMapping(nextMapping);
        setStep("map");
      },
      error: () => error("Couldn't read this file. Make sure it's a valid CSV export."),
    });
  }

  function buildPreview() {
    if (mapping.title === -1) {
      error("Choose which column contains the task title.");
      return;
    }
    const staffLite = staff.map((s) => ({ id: s.id, full_name: s.full_name }));
    const raw: RawImportRow[] = rows.map((r) => ({
      legacy_id: mapping.legacy_id !== -1 ? r[mapping.legacy_id] ?? "" : "",
      title: r[mapping.title] ?? "",
      assignedName: mapping.assignedName !== -1 ? r[mapping.assignedName] ?? "" : "",
      dueDateRaw: mapping.dueDateRaw !== -1 ? r[mapping.dueDateRaw] ?? "" : "",
      statusRaw: mapping.statusRaw !== -1 ? r[mapping.statusRaw] ?? "" : "",
      remarks: mapping.remarks !== -1 ? r[mapping.remarks] ?? "" : "",
    }));
    setParsedRows(raw.map((r) => parseImportRow(r, staffLite)));
    setStep("preview");
  }

  const includedCount = useMemo(() => parsedRows.filter((r) => r.include).length, [parsedRows]);

  function toggleRow(idx: number) {
    setParsedRows((prev) => prev.map((r, i) => (i === idx ? { ...r, include: !r.include } : r)));
  }

  async function confirmImport() {
    setImporting(true);
    try {
      const result = await importTasks(parsedRows);
      if (result.ok) {
        setImportedCount(result.imported ?? 0);
        setStep("done");
      } else {
        error(result.error ?? "Couldn't import these tasks. Check your connection and try again.");
      }
    } catch {
      error("Couldn't import these tasks. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  if (step === "upload") {
    return (
      <div>
        <EmptyState
          icon={FileSpreadsheet}
          title="Import your Excel task board"
          description="In Excel: File → Save As → CSV (Comma delimited), then upload it here. This is a one-time import — after this, the app is the source of truth."
          action={
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Choose CSV file
              </Button>
            </>
          }
        />
      </div>
    );
  }

  if (step === "map") {
    return (
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
        <h2 className="mb-1 font-semibold">Match your columns</h2>
        <p className="mb-4 text-sm text-muted">We guessed a few — please check them before continuing.</p>
        {(Object.keys(FIELD_LABELS) as FieldKey[]).map((field) => (
          <FieldGroup key={field}>
            <Label>{FIELD_LABELS[field]}</Label>
            <Select
              value={mapping[field]}
              onChange={(e) => setMapping((m) => ({ ...m, [field]: Number(e.target.value) }))}
            >
              <option value={-1}>Not in file</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h || `Column ${i + 1}`}
                </option>
              ))}
            </Select>
          </FieldGroup>
        ))}
        <Button fullWidth onClick={buildPreview}>
          Continue
        </Button>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted">
            {includedCount} of {parsedRows.length} rows will be imported
          </p>
          <Button loading={importing} onClick={confirmImport} disabled={includedCount === 0}>
            Import {includedCount} tasks
          </Button>
        </div>
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="p-3"></th>
                <th className="p-3">Task</th>
                <th className="p-3">Assigned</th>
                <th className="p-3">Due</th>
                <th className="p-3">Status</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {parsedRows.map((row, i) => (
                <tr key={i} className={!row.include ? "opacity-40" : undefined}>
                  <td className="p-3">
                    <input type="checkbox" checked={row.include} onChange={() => toggleRow(i)} className="h-4 w-4 accent-[var(--brand)]" />
                  </td>
                  <td className="p-3 font-medium">{row.title || <span className="italic text-danger">Missing title</span>}</td>
                  <td className="p-3">{row.matchedAssigneeName ?? <span className="text-muted">Unassigned</span>}</td>
                  <td className="p-3">{row.due_date ?? <span className="text-muted">—</span>}</td>
                  <td className="p-3">{STATUS_LABELS[row.status]}</td>
                  <td className="p-3">
                    {row.warnings.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" /> {row.warnings[0]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <EmptyState
      icon={CheckCircle2}
      title={`Imported ${importedCount} tasks`}
      description="They're now in the active task list, ready to assign and track."
      action={
        <Link href="/tasks">
          <Button>Go to tasks</Button>
        </Link>
      }
    />
  );
}
