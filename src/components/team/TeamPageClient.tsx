"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/Overlay";
import { CreateTeamMemberForm } from "@/components/team/CreateTeamMemberForm";
import { TeamList } from "@/components/team/TeamList";
import type { Profile } from "@/lib/types";

export function TeamPageClient({ team, currentUserId }: { team: Profile[]; currentUserId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted">Manage manager, staff, and owner accounts</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" /> Add
        </Button>
      </header>

      <TeamList team={team} currentUserId={currentUserId} />

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Add team member">
        <CreateTeamMemberForm
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </BottomSheet>
    </div>
  );
}
