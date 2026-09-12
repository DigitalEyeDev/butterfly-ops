"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "gradient" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand text-brand-foreground shadow-sm hover:bg-brand-strong hover:-translate-y-px active:translate-y-0",
  gradient:
    "text-white shadow-[var(--glow-brand)] hover:brightness-[1.08] hover:-translate-y-px hover:shadow-[0_10px_28px_-6px_rgba(124,58,237,0.55)] active:translate-y-0",
  secondary: "bg-surface-muted text-foreground hover:bg-border/60",
  outline: "border border-border bg-surface text-foreground hover:bg-surface-muted hover:border-brand/30",
  ghost: "text-foreground hover:bg-surface-muted",
  danger: "bg-danger text-white hover:brightness-95",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-[15px] gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, fullWidth, disabled, style, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      style={variant === "gradient" ? { background: "var(--brand-gradient)", ...style } : style}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium transition-all duration-200",
        "disabled:opacity-50 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        "active:scale-[0.97]",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  label: string;
  size?: Size;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant = "ghost", size = "md", label, style, children, ...props },
  ref
) {
  const dims = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-12 w-12" : "h-11 w-11";
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      style={variant === "gradient" ? { background: "var(--brand-gradient)", ...style } : style}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        "active:scale-[0.94]",
        variantClasses[variant],
        dims,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
