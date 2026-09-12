import Link from "next/link";
import { Settings, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getBranch, getStaffAttendanceOverview } from "@/lib/queries";
import { computeExceptions, formatAttendanceDate, todayInParkTZ } from "@/lib/attendance";
import { OverviewSummary } from "@/components/attendance/OverviewSummary";
import { AttendanceRow } from "@/components/attendance/AttendanceRow";
import { AttendanceFilterBar } from "@/components/attendance/AttendanceFilterBar";
import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function AttendanceOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireRole("manager", "owner");
  const sp = await searchParams;
  const today = todayInParkTZ();
  const date = sp.date ?? today;
  const isPastDay = date < today;

  const [branch, records] = await Promise.all([getBranch(profile.branch_id), getStaffAttendanceOverview(profile.branch_id, date)]);

  const filtered = sp.q
    ? records.filter((r) => r.user?.full_name.toLowerCase().includes(sp.q!.toLowerCase()))
    : records;

  const branchSettings = { expected_start_time: branch?.expected_start_time ?? "10:00" };
  const exceptionCount = records.reduce(
    (sum, r) => sum + (r.id.startsWith("placeholder-") ? 0 : computeExceptions(r, r.events ?? [], branchSettings, isPastDay).length),
    0
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Staff attendance</h1>
          <p className="text-sm text-muted">{formatAttendanceDate(date)}</p>
        </div>
        {profile.role === "manager" && (
          <Link href="/attendance/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" /> Settings
            </Button>
          </Link>
        )}
      </header>

      <section className="mb-6">
        <OverviewSummary records={records} exceptionCount={exceptionCount} />
      </section>

      <AttendanceFilterBar />

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No staff yet" description="Add staff accounts from the Team page to start tracking attendance." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((record) => (
            <AttendanceRow key={record.id} record={record} branch={branchSettings} isPastDay={isPastDay} />
          ))}
        </div>
      )}
    </div>
  );
}
