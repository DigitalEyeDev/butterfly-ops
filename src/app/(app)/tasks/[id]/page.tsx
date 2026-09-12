import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getTask, getTaskUpdates, getEvidence, getCategories, getStaff } from "@/lib/queries";
import { StatusBadge, PriorityBadge, CategoryTag } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Timeline } from "@/components/ui/Timeline";
import { EvidenceGallery } from "@/components/ui/EvidenceGallery";
import { EvidenceUpload } from "@/components/tasks/EvidenceUpload";
import { RemarkForm } from "@/components/tasks/RemarkForm";
import { ApprovalActions } from "@/components/tasks/ApprovalActions";
import { TaskDetailActions } from "@/components/tasks/TaskDetailActions";
import { formatDate, isOverdue, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("manager", "staff", "owner");
  const { id } = await params;

  const task = await getTask(id);
  if (!task) notFound();

  const [updates, evidence, categories, staff] = await Promise.all([
    getTaskUpdates(id),
    getEvidence(id),
    profile.role === "manager" ? getCategories(profile.branch_id) : Promise.resolve([]),
    profile.role === "manager" ? getStaff(profile.branch_id) : Promise.resolve([]),
  ]);

  const overdue = isOverdue(task.due_date, task.status);
  const canEditRemark = profile.role === "manager" || (profile.role === "staff" && task.assigned_to === profile.id);
  const canAttachEvidence = profile.role === "manager" || (profile.role === "staff" && task.assigned_to === profile.id);
  const isPending = task.status !== "COMPLETED" && task.status !== "APPROVED";
  const assigneeLostAccess = !!task.assignee && task.assignee.status !== "ACTIVE" && isPending;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href={profile.role === "staff" ? "/my-tasks" : profile.role === "owner" ? "/owner" : "/tasks"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <header className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <span>Task #{task.display_id}</span>
          <CategoryTag name={task.category?.name} />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{task.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {overdue && <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">Overdue</span>}
        </div>
      </header>

      <section className="mb-6">
        <TaskDetailActions task={task} role={profile.role} categories={categories} staff={staff} />
      </section>

      {task.status === "AWAITING_APPROVAL" && profile.role === "owner" && (
        <section className="mb-6 rounded-[var(--radius-md)] border border-warning-soft bg-warning-soft/40 p-4">
          <p className="mb-3 text-sm font-medium text-foreground">This task is waiting on your decision.</p>
          <ApprovalActions taskId={task.id} />
        </section>
      )}

      {task.status === "CHANGES_REQUESTED" && task.owner_remarks && (
        <section className="mb-6 rounded-[var(--radius-md)] border border-danger-soft bg-danger-soft/40 p-4">
          <p className="text-sm font-semibold text-danger">Owner requested changes</p>
          <p className="mt-1 text-sm text-foreground">&ldquo;{task.owner_remarks}&rdquo;</p>
        </section>
      )}

      {assigneeLostAccess && (
        <section className="mb-6 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-warning-soft bg-warning-soft/40 p-4">
          <p className="text-sm font-medium text-foreground">
            <span className="font-semibold text-warning">Assigned user no longer has access.</span>{" "}
            {profile.role === "manager" ? "Reassign this task to an active staff member." : "It needs to be reassigned by the manager."}
          </p>
        </section>
      )}

      <section className="mb-6 grid grid-cols-2 gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-4 sm:grid-cols-3">
        <Meta label="Assigned to">
          {task.assignee ? (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Avatar name={task.assignee.full_name} size="sm" /> {task.assignee.full_name}
              {task.assignee.status !== "ACTIVE" && (
                <span className="text-xs font-normal italic text-muted">(access revoked)</span>
              )}
            </span>
          ) : (
            <span className="italic text-muted">Unassigned</span>
          )}
        </Meta>
        <Meta label="Created by">{task.creator?.full_name ?? "—"}</Meta>
        <Meta label="Created">{formatDate(task.created_at)}</Meta>
        <Meta label="Due date">
          <span className={cn(overdue && "font-semibold text-danger")}>{formatDate(task.due_date)}</span>
        </Meta>
        <Meta label="Completed">{formatDate(task.completed_at)}</Meta>
        <Meta label="Approved">{formatDate(task.approved_at)}</Meta>
      </section>

      {task.description && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Description</h2>
          <p className="whitespace-pre-wrap text-sm text-foreground">{task.description}</p>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Manager remarks</h2>
        {task.manager_remarks ? (
          <p className="mb-3 whitespace-pre-wrap rounded-[var(--radius-sm)] bg-surface-muted p-3 text-sm text-foreground">{task.manager_remarks}</p>
        ) : (
          <p className="mb-3 text-sm text-muted">No remarks yet.</p>
        )}
        {profile.role === "manager" && <RemarkForm taskId={task.id} placeholder="Add instructions or notes for the assignee…" />}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Staff updates</h2>
        {task.staff_remarks ? (
          <p className="mb-3 whitespace-pre-wrap rounded-[var(--radius-sm)] bg-surface-muted p-3 text-sm text-foreground">{task.staff_remarks}</p>
        ) : (
          <p className="mb-3 text-sm text-muted">No updates yet.</p>
        )}
        {profile.role === "staff" && canEditRemark && <RemarkForm taskId={task.id} placeholder="Share a progress update…" />}
      </section>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Evidence</h2>
        </div>
        <div className="mb-3">
          <EvidenceGallery evidence={evidence} />
        </div>
        {canAttachEvidence && <EvidenceUpload taskId={task.id} />}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Activity</h2>
        <Timeline updates={updates} />
      </section>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  );
}
