"use client";

import { useRef, useState } from "react";
import { Camera, Paperclip } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { uploadEvidence } from "@/lib/actions/evidence";

export function EvidenceUpload({ taskId }: { taskId: string }) {
  const { success, error } = useToast();
  const [pending, setPending] = useState<"photo" | "file" | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submitFile(file: File, kind: "photo" | "file") {
    setPending(kind);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadEvidence(taskId, formData);
      if (result.ok) {
        success("Evidence attached.");
      } else {
        error(result.error ?? "Couldn't upload this file. Check your connection and try again.");
      }
    } catch {
      error("Couldn't upload this file. Check your connection and try again.");
    } finally {
      setPending(null);
      if (photoRef.current) photoRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && submitFile(e.target.files[0], "photo")}
      />
      <Button variant="outline" size="sm" loading={pending === "photo"} onClick={() => photoRef.current?.click()}>
        <Camera className="h-4 w-4" /> Add photo
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && submitFile(e.target.files[0], "file")}
      />
      <Button variant="outline" size="sm" loading={pending === "file"} onClick={() => fileRef.current?.click()}>
        <Paperclip className="h-4 w-4" /> Attach file
      </Button>
    </div>
  );
}
