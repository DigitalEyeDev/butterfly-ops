import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { EditNameForm } from "@/components/account/EditNameForm";

export default async function AccountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center gap-3">
        <Avatar name={profile.full_name} size="lg" />
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">{profile.full_name}</h1>
          <p className="text-sm capitalize text-muted">{profile.role} · {profile.email}</p>
        </div>
      </header>

      <section className="mb-6 rounded-[var(--radius-lg)] border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Your name</h2>
        <EditNameForm initialName={profile.full_name} />
      </section>

      <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Change password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
