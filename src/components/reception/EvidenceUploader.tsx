"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Loader2, ImageOff } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { uploadReceptionEvidence, removeReceptionEvidence } from "@/lib/actions/reception";
import type { ReceptionReviewEvidence } from "@/lib/types";

/**
 * Multi-image evidence for the reported review count — "a typed number
 * alone is not proof" (see the Reception spec). Upload/preview/remove
 * before submission; read-only once the report leaves DRAFT/CORRECTION
 * (the server enforces this independently via RLS + the storage policies
 * in supabase/reception.sql, this just matches that in the UI).
 */
export function EvidenceUploader({
  reportId,
  evidence,
  editable,
}: {
  reportId: string;
  evidence: ReceptionReviewEvidence[];
  editable: boolean;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        const result = await uploadReceptionEvidence(reportId, fd);
        if (!result.ok) {
          error(result.error ?? "Couldn't upload this file.");
          break;
        }
      }
      router.refresh();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove(id: string) {
    setRemovingId(id);
    startTransition(async () => {
      try {
        const result = await removeReceptionEvidence(id);
        if (result.ok) {
          success("Evidence removed.");
          router.refresh();
        } else {
          error(result.error ?? "Couldn't remove this file.");
        }
      } finally {
        setRemovingId(null);
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {evidence.map((item) => (
          <div
            key={item.id}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-border bg-surface-muted"
          >
            {item.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="Review evidence" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted">
                <ImageOff className="h-5 w-5" aria-hidden />
              </div>
            )}
            {editable && (
              <IconButton
                label="Remove evidence"
                size="sm"
                variant="danger"
                className="absolute right-1 top-1 h-6 w-6"
                disabled={removingId === item.id}
                onClick={() => handleRemove(item.id)}
              >
                {removingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              </IconButton>
            )}
          </div>
        ))}

        {editable && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-dashed border-border text-muted transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Upload className="h-5 w-5" aria-hidden />}
            <span className="text-[10px] font-medium">Add photo</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {evidence.length === 0 && !editable && <p className="text-sm text-muted">No evidence attached.</p>}
    </div>
  );
}
