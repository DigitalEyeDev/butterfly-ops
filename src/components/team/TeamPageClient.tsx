"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/Overlay";
import { CreateTeamMemberForm } from "@/components/team/CreateTeamMemberForm";
import { TeamList } from "@/components/team/TeamList";
import { DepartmentManager } from "@/components/team/DepartmentManager";
import type { Department, Profile } from "@/lib/types";

export function TeamPageClient({
  team,
  departments,
  currentUserId,
  canManageMembers,
}: {
  team: Profile[];
  departments: Department[];
  currentUserId: string;
  canManageMembers: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted">Manage people and departments</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => setDeptOpen(true)}>
            <Building2 className="h-4 w-4" /> Departments
          </Button>
          {canManageMembers && (
            <Button onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add
            </Button>
          )}
        </div>
      </header>

      <TeamList team={team} currentUserId={currentUserId} canManageMembers={canManageMembers} />

      {canManageMembers && (
        <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add team member">
          <CreateTeamMemberForm
            departments={departments.filter((d) => d.is_active)}
            onSuccess={() => {
              setAddOpen(false);
              router.refresh();
            }}
          />
        </BottomSheet>
      )}

      <BottomSheet open={deptOpen} onClose={() => setDeptOpen(false)} title="Departments">
        <DepartmentManager departments={departments} />
      </BottomSheet>
    </div>
  );
}
