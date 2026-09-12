"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { ActionResult } from "@/lib/actions/auth";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export async function uploadEvidence(taskId: string, formData: FormData): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a photo or file to attach." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "That file is too large. Please attach something under 15MB." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "Only photos and PDF files can be attached." };
  }

  const supabase = await createClient();

  // Confirm the caller can actually see this task before touching storage —
  // RLS on `tasks` already restricts this select to permitted rows.
  const { data: task } = await supabase.from("tasks").select("id, assigned_to").eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, error: "This task no longer exists." };
  if (profile.role === "staff" && task.assigned_to !== profile.id) {
    return { ok: false, error: "You can only attach evidence to your own tasks." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const path = `${taskId}/${randomUUID()}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from("evidence").upload(path, arrayBuffer, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return { ok: false, error: "Couldn't upload this file. Check your connection and try again." };
  }

  const { error: insertError } = await supabase.from("evidence").insert({
    task_id: taskId,
    uploaded_by: profile.id,
    file_path: path,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
  });
  if (insertError) {
    await supabase.storage.from("evidence").remove([path]);
    return { ok: false, error: "Couldn't save this file. Check your connection and try again." };
  }

  await supabase.from("task_updates").insert({
    task_id: taskId,
    actor_id: profile.id,
    action: "evidence_added",
    new_value: file.name,
  });

  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function deleteEvidence(evidenceId: string, taskId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "manager") {
    return { ok: false, error: "Only a manager can remove evidence." };
  }
  const supabase = await createClient();
  const { data: item } = await supabase.from("evidence").select("file_path").eq("id", evidenceId).maybeSingle();
  if (!item) return { ok: false, error: "This file no longer exists." };

  await supabase.storage.from("evidence").remove([item.file_path]);
  const { error } = await supabase.from("evidence").delete().eq("id", evidenceId);
  if (error) return { ok: false, error: "Couldn't remove this file. Check your connection and try again." };

  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}
