"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { BottomSheet } from "@/components/ui/Overlay";
import { TaskForm } from "@/components/tasks/TaskForm";
import { createTask } from "@/lib/actions/tasks";
import type { Category, Profile } from "@/lib/types";

export function AddTaskFab({ categories, staff }: { categories: Category[]; staff: Profile[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ background: "var(--brand-gradient)", boxShadow: "var(--glow-brand)" }}
        className="fixed bottom-24 right-4 z-30 flex h-14 items-center gap-2 rounded-full px-5 font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-4px_rgba(124,58,237,0.55)] active:scale-95 sm:bottom-8 sm:right-8"
      >
        <Plus className="h-5 w-5" />
        Add task
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="New task">
        <TaskForm categories={categories} staff={staff} action={createTask} onSuccess={() => setOpen(false)} submitLabel="Create task" />
      </BottomSheet>
    </>
  );
}
