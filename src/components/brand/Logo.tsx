import { cn } from "@/lib/utils";

/**
 * Abstract, geometric butterfly mark — four soft "wing" petals meeting at a
 * center body, upper wings in the full brand gradient and lower wings in a
 * translucent echo of it for depth. Deliberately not a literal illustration:
 * a logomark should read clearly at 20px in a tab bar, not just at hero size.
 */
export function LogoMark({ className, animated }: { className?: string; animated?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(animated && "animate-float", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="wing-grad" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="55%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {/* lower wings — softer echo, laid down first for depth */}
      <path d="M20 20 C18 29 9 33 5.5 27.5 C2.5 22.5 11 17.5 20 20 Z" fill="url(#wing-grad)" opacity="0.4" />
      <path d="M20 20 C22 29 31 33 34.5 27.5 C37.5 22.5 29 17.5 20 20 Z" fill="url(#wing-grad)" opacity="0.4" />
      {/* upper wings — the main gradient */}
      <path d="M20 19 C20 8 7 3 3.5 10.5 C0.5 17.5 9.5 23 20 19 Z" fill="url(#wing-grad)" />
      <path d="M20 19 C20 8 33 3 36.5 10.5 C39.5 17.5 30.5 23 20 19 Z" fill="url(#wing-grad)" />
      {/* body */}
      <rect x="18.6" y="11" width="2.8" height="19" rx="1.4" fill="#3b0764" />
      <path d="M19.2 11 C17.5 8.5 16.5 7 17.3 6" stroke="#3b0764" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M20.8 11 C22.5 8.5 23.5 7 22.7 6" stroke="#3b0764" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function LogoBadge({ size = 40, animated }: { size?: number; animated?: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand-soft"
      style={{ width: size, height: size, boxShadow: "var(--glow-brand)" }}
    >
      <LogoMark className="h-[68%] w-[68%]" animated={animated} />
    </span>
  );
}

export function Wordmark({ subtitle, className }: { subtitle?: string; className?: string }) {
  return (
    <div className={className}>
      <p className="font-display text-sm font-bold leading-tight tracking-tight">BUTTERFLY OPS</p>
      {subtitle && (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{subtitle}</p>
      )}
    </div>
  );
}
