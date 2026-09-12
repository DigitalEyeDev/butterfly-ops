/**
 * Soft, blurred gradient shapes for hero surfaces (login, empty states).
 * Purely decorative — absolutely positioned, non-interactive, and clipped
 * by the parent's overflow-hidden so it never affects layout or scroll.
 */
export function BlobBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="animate-blob-drift absolute -left-24 -top-32 h-80 w-80 rounded-full opacity-[0.35] blur-3xl"
        style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 70%)" }}
      />
      <div
        className="animate-blob-drift absolute -right-20 top-1/3 h-72 w-72 rounded-full opacity-[0.3] blur-3xl"
        style={{ background: "radial-gradient(circle, #ec4899 0%, transparent 70%)", animationDelay: "-5s" }}
      />
      <div
        className="animate-blob-drift absolute bottom-0 left-1/4 h-64 w-64 rounded-full opacity-[0.25] blur-3xl"
        style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)", animationDelay: "-9s" }}
      />
    </div>
  );
}
