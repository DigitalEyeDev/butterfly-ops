"use client";

import { useState, useTransition } from "react";
import { MoreVertical, ShieldOff } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AccountStatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { setTeamMemberActive, removeTeamMember } from "@/lib/actions/users";
import type { Profile } from "@/lib/types";

export function TeamList({ team, currentUserId }: { team: Profile[]; currentUserId: string }) {
  const { success, error } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null);
  const [, startTransition] = useTransition();

  function toggle(member: Profile) {
    setPendingId(member.id);
    startTransition(async () => {
      try {
        const result = await setTeamMemberActive(member.id, !member.is_active);
        if (result.ok) {
          success(member.is_active ? `${member.full_name} deactivated.` : `${member.full_name} reactivated.`);
        } else {
          error(result.error ?? "Couldn't update this account. Check your connection and try again.");
        }
      } finally {
        setPendingId(null);
      }
    });
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    const result = await removeTeamMember(removeTarget.id);
    if (result.ok) {
      success(`${removeTarget.full_name}'s access has been revoked.`);
    } else {
      error(result.error ?? "Couldn't remove this account. Check your connection and try again.");
    }
  }

  return (
    <>
      <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface">
        {team.map((member) => {
          const isSelf = member.id === currentUserId;
          const isRemoved = member.status === "REMOVED";
          return (
            <li key={member.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={member.full_name} className={isRemoved ? "opacity-50" : undefined} />
                <div className="min-w-0">
                  <p className={cnTruncate(isRemoved)}>{member.full_name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs capitalize text-muted">{member.role}</span>
                    <AccountStatusBadge status={member.status} />
                  </div>
                  {isRemoved && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-danger">
                      <ShieldOff className="h-3 w-3" /> Access revoked
                    </p>
                  )}
                </div>
              </div>

              {!isSelf && !isRemoved && (
                <Dropdown
                  trigger={
                    <IconButton label={`Actions for ${member.full_name}`} variant="outline" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </IconButton>
                  }
                  options={[
                    {
                      label: member.is_active ? "Deactivate" : "Reactivate",
                      onSelect: () => toggle(member),
                    },
                    {
                      label: "Remove user",
                      destructive: true,
                      onSelect: () => setRemoveTarget(member),
                    },
                  ]}
                />
              )}
              {pendingId === member.id && <span className="text-xs text-muted">Saving…</span>}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        title={`Remove ${removeTarget?.full_name.split(" ")[0] ?? "this user"}?`}
        description="Removing this user will revoke their access to Butterfly Ops. Their historical tasks, approvals, and activity records will be preserved."
        confirmLabel="Remove user"
        destructive
      />
    </>
  );
}

function cnTruncate(muted: boolean) {
  return muted ? "truncate text-sm font-medium text-muted" : "truncate text-sm font-medium";
}
