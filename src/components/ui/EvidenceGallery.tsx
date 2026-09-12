"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import type { Evidence } from "@/lib/types";
import { Overlay } from "@/components/ui/Overlay";

function isImage(fileType: string | null) {
  return !!fileType && fileType.startsWith("image/");
}

export function EvidenceGallery({ evidence }: { evidence: Evidence[] }) {
  const [preview, setPreview] = useState<Evidence | null>(null);

  if (evidence.length === 0) {
    return <p className="text-sm text-muted">No evidence attached.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {evidence.map((item) => (
          <button
            key={item.id}
            onClick={() => setPreview(item)}
            className="group relative aspect-square overflow-hidden rounded-[var(--radius-sm)] border border-border bg-surface-muted"
          >
            {isImage(item.file_type) && item.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt={item.file_name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-muted">
                <FileText className="h-5 w-5" aria-hidden />
                <span className="line-clamp-2 text-center text-[10px]">{item.file_name}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      <Overlay open={!!preview} onClose={() => setPreview(null)} variant="center" maxWidth="max-w-xl" title={preview?.file_name}>
        {preview && (
          isImage(preview.file_type) && preview.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt={preview.file_name} className="w-full rounded-[var(--radius-sm)]" />
          ) : preview.url ? (
            <a
              href={preview.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-brand hover:underline"
            >
              <FileText className="h-4 w-4" /> Open {preview.file_name}
            </a>
          ) : (
            <p className="text-sm text-muted">Unable to load this file.</p>
          )
        )}
      </Overlay>
    </>
  );
}
