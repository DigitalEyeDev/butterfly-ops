import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getBranch } from "@/lib/queries";
import { AttendanceSettingsForm } from "@/components/attendance/AttendanceSettingsForm";

export const dynamic = "force-dynamic";

export default async function AttendanceSettingsPage() {
  const manager = await requireRole("manager");
  const branch = await getBranch(manager.branch_id);
  if (!branch) return null;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/attendance" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Attendance settings</h1>
        <p className="text-sm text-muted">Configure the park&apos;s location and shift policy used for everyone&apos;s attendance.</p>
      </header>

      <AttendanceSettingsForm branch={branch} />
    </div>
  );
}
