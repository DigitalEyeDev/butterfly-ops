"use client";

import { useActionState } from "react";
import { Mail, Lock } from "lucide-react";
import { signIn, type ActionResult } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/Field";
import { LogoBadge } from "@/components/brand/Logo";
import { BlobBackdrop } from "@/components/brand/BlobBackdrop";

const initialState: ActionResult = { ok: true };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <BlobBackdrop />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoBadge size={64} animated />
          <h1 className="font-display mt-4 text-2xl font-extrabold tracking-tight">BUTTERFLY OPS</h1>
          <span className="mt-2 inline-flex items-center rounded-full bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted shadow-[var(--shadow-card)]">
            Bhubaneswar Park Operations
          </span>
        </div>

        <form
          action={formAction}
          className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface p-6 pt-7 shadow-[var(--shadow-pop)]"
        >
          <span
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ background: "var(--brand-gradient)" }}
            aria-hidden
          />

          <FieldGroup>
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="you@butterflypark.com"
                className="pl-10"
              />
            </div>
          </FieldGroup>
          <FieldGroup className="mb-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="pl-10"
              />
            </div>
          </FieldGroup>
          {!state.ok && state.error && <FieldError>{state.error}</FieldError>}
          <Button type="submit" variant="gradient" fullWidth size="lg" loading={pending} className="mt-4">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Don&apos;t have an account? Ask your park manager to set one up for you.
        </p>
      </div>
    </main>
  );
}
