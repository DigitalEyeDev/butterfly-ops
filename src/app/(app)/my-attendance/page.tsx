import { requireRole } from "@/lib/auth";
import { getBranch, getMyAttendanceToday, getMyAttendanceHistory } from "@/lib/queries";
import { TodayStatusCard } from "@/components/attendance/TodayStatusCard";
import { MyHistoryList } from "@/components/attendance/MyHistoryList";

export const dynamic = "force-dynamic";

export default async function MyAttendancePage() {
  const staff = await requireRole("staff");

  const [branch, today, history] = await Promise.all([
    getBranch(staff.branch_id),
    getMyAttendanceToday(staff.id),
    getMyAttendanceHistory(staff.id),
  ]);

  return (
    <div className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted">Clock in, take lunch, and clock out — verified by photo and location.</p>
      </header>

      <section className="mb-8">
        <TodayStatusCard
          record={today}
          branch={{
            attendance_lat: branch?.attendance_lat ?? null,
            attendance_lng: branch?.attendance_lng ?? null,
            attendance_radius_m: branch?.attendance_radius_m ?? 150,
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">History</h2>
        <MyHistoryList records={history.filter((r) => r.status !== "NOT_STARTED")} />
      </section>
    </div>
  );
}
