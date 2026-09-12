"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, Users, Upload, LogOut, ClipboardList, UserCircle, Clock, Ticket } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui/Avatar";
import { LogoBadge, Wordmark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

function navFor(role: Profile["role"]): NavItem[] {
  if (role === "manager") {
    return [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
      { href: "/attendance", label: "Attendance", icon: Clock },
      { href: "/reception", label: "Reception", icon: Ticket },
      { href: "/import", label: "Import", icon: Upload },
      { href: "/team", label: "Team", icon: Users },
    ];
  }
  if (role === "owner") {
    return [
      { href: "/owner", label: "Home", icon: LayoutDashboard },
      { href: "/tasks", label: "All tasks", icon: ListChecks },
      { href: "/attendance", label: "Attendance", icon: Clock },
      { href: "/reception", label: "Reception", icon: Ticket },
      { href: "/team", label: "Team", icon: Users },
    ];
  }
  if (role === "receptionist") {
    // Deliberately just one working screen — the receptionist's whole job
    // here is filing the daily report, so /reception doubles as both their
    // "Home" and their "Reception" area rather than splitting into two
    // near-identical screens (see the plan's reasoning: "should not need
    // to navigate through complicated screens").
    return [{ href: "/reception", label: "Reception", icon: Ticket }];
  }
  return [
    { href: "/my-tasks", label: "My tasks", icon: ClipboardList },
    { href: "/my-attendance", label: "Attendance", icon: Clock },
  ];
}

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = navFor(profile.role);

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex sm:w-60 sm:flex-col sm:border-r sm:border-border sm:bg-surface sm:py-6">
        <div className="mb-8 flex items-center gap-2.5 px-5">
          <LogoBadge size={38} />
          <Wordmark subtitle="Bhubaneswar" />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-surface-muted hover:text-foreground"
                )}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full"
                    style={{ background: "var(--brand-gradient)" }}
                    aria-hidden
                  />
                )}
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-border px-3 pt-4">
          <Link href="/account" className="mb-1 flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2 hover:bg-surface-muted">
            <Avatar name={profile.full_name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs capitalize text-muted">{profile.role}</p>
            </div>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:hidden">
        <div className="flex items-center gap-2.5">
          <LogoBadge size={34} />
          <Wordmark subtitle="Bhubaneswar" />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/account" aria-label="Account" className="text-muted">
            <UserCircle className="h-5 w-5" />
          </Link>
          <form action={signOut}>
            <button type="submit" aria-label="Sign out" className="text-muted">
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>
      </header>

      <main className="min-w-0 flex-1 pb-20 sm:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/90 backdrop-blur-md sm:hidden">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-brand" : "text-muted"
              )}
            >
              {active && (
                <span
                  className="absolute top-0 h-0.5 w-8 rounded-full"
                  style={{ background: "var(--brand-gradient)" }}
                  aria-hidden
                />
              )}
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
