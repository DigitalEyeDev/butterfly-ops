"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireRole } from "@/lib/auth";
import { receptionDraftSchema, correctionReasonSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/actions/auth";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB — a phone screenshot, not a document
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** FormData gives back "" for an empty number input, and zod's `.optional()`
 * only treats `undefined` as absent — an empty string would otherwise
 * coerce to 0 and look like a real reported value of zero. */
function emptyToUndefined(v: FormDataEntryValue | null): string | undefined {
  if (v === null) return undefined;
  const s = String(v);
  return s === "" ? undefined : s;
}

/**
 * Saves (creates or updates) today's reception draft. The business date is
 * never taken from the client — save_reception_draft derives "today" from
 * the server clock itself, exactly like record_attendance_event does for
 * attendance, so a receptionist's device clock can never backdate or
 * duplicate a report. Returns the report id so the caller can immediately
 * submit or attach evidence without a page round-trip.
 */
export async function saveReceptionDraft(formData: FormData): Promise<ActionResult & { reportId?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };
  if (profile.role !== "receptionist") return { ok: false, error: "Only a receptionist can file this report." };

  const parsed = receptionDraftSchema.safeParse({
    visitors_count: emptyToUndefined(formData.get("visitors_count")),
    tickets_sold: emptyToUndefined(formData.get("tickets_sold")),
    socks_sold: emptyToUndefined(formData.get("socks_sold")),
    review_count: emptyToUndefined(formData.get("review_count")),
    remarks: String(formData.get("remarks") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  // save_reception_draft returns the reception_reports row directly (a
  // single composite value, not a set) — no .select() needed.
  const { data, error } = await supabase.rpc("save_reception_draft", {
    p_visitors: v.visitors_count ?? null,
    p_tickets: v.tickets_sold ?? null,
    p_socks: v.socks_sold ?? null,
    p_reviews: v.review_count ?? null,
    p_remarks: v.remarks || null,
  });
  if (error) return { ok: false, error: friendlyRpcError(error.message) };

  revalidatePath("/reception");
  return { ok: true, reportId: (data as { id: string } | null)?.id };
}

export async function submitReceptionReport(reportId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };
  if (profile.role !== "receptionist") return { ok: false, error: "Only a receptionist can submit this report." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_reception_report", { p_report_id: reportId });
  if (error) return { ok: false, error: friendlyRpcError(error.message) };

  revalidatePath("/reception");
  revalidatePath("/dashboard");
  revalidatePath("/owner");
  return { ok: true };
}

export async function uploadReceptionEvidence(reportId: string, formData: FormData): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };
  if (profile.role !== "receptionist") return { ok: false, error: "Only a receptionist can attach evidence." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a screenshot or photo to attach." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "That file is too large. Please attach something under 8MB." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "Only JPEG, PNG, or WebP images can be attached." };
  }

  const supabase = await createClient();

  // RLS on reception_reports already scopes this select to the caller's
  // branch — confirm the report exists and is still editable before
  // touching storage.
  const { data: report } = await supabase.from("reception_reports").select("id, status").eq("id", reportId).maybeSingle();
  if (!report) return { ok: false, error: "This report no longer exists." };
  if (report.status !== "DRAFT" && report.status !== "CORRECTION_REQUESTED") {
    return { ok: false, error: "This report can no longer be edited." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const path = `${reportId}/${randomUUID()}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from("reception-evidence").upload(path, arrayBuffer, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return { ok: false, error: "Couldn't upload this file. Check your connection and try again." };

  const { error: insertError } = await supabase.from("reception_review_evidence").insert({
    report_id: reportId,
    uploaded_by: profile.id,
    file_path: path,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
  });
  if (insertError) {
    await supabase.storage.from("reception-evidence").remove([path]);
    return { ok: false, error: "Couldn't save this file. Check your connection and try again." };
  }

  revalidatePath("/reception");
  return { ok: true };
}

export async function removeReceptionEvidence(evidenceId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };

  const supabase = await createClient();
  const { data: item } = await supabase.from("reception_review_evidence").select("file_path").eq("id", evidenceId).maybeSingle();
  if (!item) return { ok: false, error: "This file no longer exists." };

  // The real gate is the delete RLS policy (uploaded_by = auth.uid() and
  // the report is still DRAFT/CORRECTION_REQUESTED) — this call simply
  // deletes 0 rows if that doesn't apply, same as every other RLS-gated
  // mutation in this app.
  const { error, count } = await supabase.from("reception_review_evidence").delete({ count: "exact" }).eq("id", evidenceId);
  if (error) return { ok: false, error: "Couldn't remove this file. Check your connection and try again." };
  if (!count) return { ok: false, error: "This file can no longer be removed." };

  await supabase.storage.from("reception-evidence").remove([item.file_path]);

  revalidatePath("/reception");
  return { ok: true };
}

export async function verifyReceptionReport(reportId: string, remark?: string): Promise<ActionResult> {
  await requireRole("manager");
  const supabase = await createClient();
  const { error } = await supabase.rpc("manager_verify_reception_report", {
    p_report_id: reportId,
    p_remark: remark || null,
  });
  if (error) return { ok: false, error: friendlyRpcError(error.message) };

  revalidatePath("/reception");
  return { ok: true };
}

export async function requestReceptionCorrection(reportId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("manager");

  const parsed = correctionReasonSchema.safeParse({ reason: String(formData.get("reason") ?? "") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Explain what needs to be corrected." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("manager_request_reception_correction", {
    p_report_id: reportId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: friendlyRpcError(error.message) };

  revalidatePath("/reception");
  return { ok: true };
}

// These are all hand-written, user-appropriate messages the RPCs themselves
// raise (see supabase/reception.sql) — safe to surface directly, unlike a
// raw database/constraint error.
const KNOWN_RPC_MESSAGES = [
  "Only a receptionist can file this report",
  "Only a receptionist can submit this report",
  "Only a manager can verify this report",
  "Only a manager can request a correction",
  "Visitors cannot be negative",
  "Tickets sold cannot be negative",
  "Socks sold cannot be negative",
  "Review count cannot be negative",
  "This report has already been submitted",
  "Report not found",
  "Fill in visitors, tickets sold, socks sold, and reviews before submitting",
  "Please attach evidence for the reported reviews before submitting",
  "Only a submitted report can be verified",
  "Only a submitted report can have a correction requested",
  "Explain what needs to be corrected",
];

function friendlyRpcError(message: string | undefined): string {
  if (message && KNOWN_RPC_MESSAGES.some((m) => message.includes(m))) return message;
  return "Couldn't save this. Check your connection and try again.";
}
