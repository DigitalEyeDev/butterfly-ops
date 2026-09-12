"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireRole } from "@/lib/auth";
import { attendanceSettingsSchema, adjustAttendanceSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/actions/auth";
import type { AttendanceEventType } from "@/lib/types";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB — a phone selfie, not a document
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Selfie required for clock-in/out (identity + presence evidence for the
// two events that bookend pay); optional for lunch to keep a 30-minute
// break low-friction — location is still captured either way.
const SELFIE_REQUIRED: Record<AttendanceEventType, boolean> = {
  CLOCK_IN: true,
  LUNCH_START: false,
  LUNCH_END: false,
  CLOCK_OUT: true,
};

/**
 * Records one attendance event. This is the ONLY place that calls
 * record_attendance_event — the RPC itself re-derives who the caller is,
 * ignores any client timestamp, validates the event sequence, and scores
 * location server-side (see supabase/attendance.sql). This action's job
 * is just: validate/upload the selfie, then hand the RPC whatever GPS
 * reading the browser reported.
 */
export async function recordAttendanceEvent(
  eventType: AttendanceEventType,
  formData: FormData
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };
  if (profile.role !== "staff") return { ok: false, error: "Only staff members clock in and out." };

  const supabase = await createClient();

  const file = formData.get("selfie");
  let evidencePath: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return { ok: false, error: "That photo is too large. Please try again." };
    if (!ALLOWED_TYPES.has(file.type)) return { ok: false, error: "Couldn't read that photo. Please try again." };

    const path = `${profile.id}/${eventType}-${randomUUID()}.jpg`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from("attendance-selfies").upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) return { ok: false, error: "Couldn't upload your photo. Check your connection and try again." };
    evidencePath = path;
  } else if (SELFIE_REQUIRED[eventType]) {
    return { ok: false, error: "A selfie is required for this step." };
  }

  const permission = String(formData.get("location_permission") ?? "unavailable");
  const latRaw = formData.get("latitude");
  const lngRaw = formData.get("longitude");
  const accRaw = formData.get("accuracy_meters");

  const { error } = await supabase.rpc("record_attendance_event", {
    p_event_type: eventType,
    p_latitude: latRaw ? Number(latRaw) : null,
    p_longitude: lngRaw ? Number(lngRaw) : null,
    p_accuracy_meters: accRaw ? Number(accRaw) : null,
    p_location_permission: permission,
    p_evidence_image_path: evidencePath,
  });

  if (error) {
    if (evidencePath) await supabase.storage.from("attendance-selfies").remove([evidencePath]);
    return { ok: false, error: friendlyRpcError(error.message) };
  }

  revalidatePath("/my-attendance");
  revalidatePath("/attendance");
  return { ok: true };
}

// These are all hand-written, already user-appropriate messages raised by
// record_attendance_event itself (see supabase/attendance.sql) — safe to
// surface directly rather than hiding behind a generic fallback, unlike a
// raw database/constraint error.
const KNOWN_RPC_MESSAGES = [
  "You have already clocked in today",
  "Clock in before starting lunch",
  "You are already on lunch",
  "You are not currently on lunch",
  "Clock in before you can clock out",
  "End your lunch before clocking out",
  "You have already completed today's shift",
  "You have already taken your lunch break today",
  "Only staff members clock in and out",
  "Your account no longer has access to Butterfly Ops",
];

function friendlyRpcError(message: string | undefined): string {
  if (message && KNOWN_RPC_MESSAGES.some((m) => message.includes(m))) return message;
  return "Couldn't record this. Check your connection and try again.";
}

export async function updateAttendanceSettings(formData: FormData): Promise<ActionResult> {
  const manager = await requireRole("manager");

  const parsed = attendanceSettingsSchema.safeParse({
    attendance_lat: String(formData.get("attendance_lat") ?? ""),
    attendance_lng: String(formData.get("attendance_lng") ?? ""),
    attendance_radius_m: String(formData.get("attendance_radius_m") ?? ""),
    expected_shift_minutes: String(formData.get("expected_shift_minutes") ?? ""),
    lunch_allowed_minutes: String(formData.get("lunch_allowed_minutes") ?? ""),
    expected_start_time: String(formData.get("expected_start_time") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("branches")
    .update({
      attendance_lat: v.attendance_lat ? Number(v.attendance_lat) : null,
      attendance_lng: v.attendance_lng ? Number(v.attendance_lng) : null,
      attendance_radius_m: v.attendance_radius_m,
      expected_shift_minutes: v.expected_shift_minutes,
      lunch_allowed_minutes: v.lunch_allowed_minutes,
      expected_start_time: v.expected_start_time,
    })
    .eq("id", manager.branch_id);

  if (error) return { ok: false, error: "Couldn't save these settings. Check your connection and try again." };

  revalidatePath("/attendance/settings");
  revalidatePath("/attendance");
  return { ok: true };
}

export async function adjustAttendance(recordId: string, formData: FormData): Promise<ActionResult> {
  await requireRole("manager");

  const parsed = adjustAttendanceSchema.safeParse({
    new_status: String(formData.get("new_status") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("manager_adjust_attendance", {
    p_record_id: recordId,
    p_new_status: parsed.data.new_status,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: "Couldn't save this adjustment. Check your connection and try again." };

  revalidatePath(`/attendance/${recordId}`);
  revalidatePath("/attendance");
  return { ok: true };
}
