import { requireRole } from "@/lib/auth";
import { getStaff } from "@/lib/queries";
import { ImportWizard } from "@/components/import/ImportWizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const manager = await requireRole("manager");
  const staff = await getStaff(manager.branch_id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Import from Excel</h1>
        <p className="text-sm text-muted">One-time import of your existing task board. Statuses are normalized automatically.</p>
      </header>

      <ImportWizard staff={staff} />
    </div>
  );
}
