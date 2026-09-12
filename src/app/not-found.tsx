import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] bg-surface-muted text-muted">
        <CompassIcon className="h-7 w-7" aria-hidden />
      </span>
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-1 max-w-xs text-sm text-muted">
          This task or page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
      </div>
      <Link href="/">
        <Button>Back to Butterfly Ops</Button>
      </Link>
    </main>
  );
}
