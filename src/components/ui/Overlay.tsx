"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/Button";

function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [active]);
}

function useEscapeKey(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onClose]);
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** "sheet": bottom sheet on mobile, centered card on larger screens (default).
   *  "center": always a centered dialog, even on mobile — for short confirmations. */
  variant?: "sheet" | "center";
  maxWidth?: string;
}

/**
 * Shared modal / bottom-sheet shell. On phones a "sheet" slides up from the
 * bottom with a drag handle (thumb-friendly, matches native app patterns);
 * from `sm:` up it renders as a centered card like a normal modal.
 */
export function Overlay({ open, onClose, title, children, footer, variant = "sheet", maxWidth = "max-w-lg" }: OverlayProps) {
  useLockBodyScroll(open);
  useEscapeKey(open, onClose);

  if (!open || typeof document === "undefined") return null;

  const isSheet = variant === "sheet";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[92vh] w-full flex-col bg-surface shadow-[var(--shadow-pop)]",
          isSheet
            ? "animate-sheet-up rounded-t-[var(--radius-lg)] sm:animate-fade-in sm:rounded-[var(--radius-lg)] sm:mb-0 sm:m-4"
            : "animate-fade-in m-4 rounded-[var(--radius-lg)]",
          maxWidth
        )}
      >
        {isSheet && (
          <div className="flex justify-center pt-2.5 sm:hidden">
            <span className="h-1.5 w-10 rounded-full bg-border" />
          </div>
        )}
        {title && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <IconButton label="Close" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Modal(props: Omit<OverlayProps, "variant">) {
  return <Overlay {...props} variant="center" maxWidth={props.maxWidth ?? "max-w-md"} />;
}

export function BottomSheet(props: Omit<OverlayProps, "variant">) {
  return <Overlay {...props} variant="sheet" />;
}
