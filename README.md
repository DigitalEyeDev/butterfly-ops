# 🦋 Butterfly Ops

**Bhubaneswar Park Operations & Task Control** — the internal task board for
Butterfly Trampoline Park, replacing the shared Excel sheet.

Built with Next.js (App Router), Supabase (Postgres + Auth + Storage), and
Tailwind CSS. Mobile-first, role-based (Manager / Staff / Owner), with every
permission enforced in the database — not just hidden in the UI.

---

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project (pick
   a region close to India, e.g. Singapore).
2. In the SQL editor, run the contents of [`supabase/schema.sql`](supabase/schema.sql),
   then [`supabase/storage.sql`](supabase/storage.sql), then
   [`supabase/attendance.sql`](supabase/attendance.sql), in that order.
3. In **Project Settings → API**, copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

## 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the three values from step 1. **Never commit `.env.local`** — the
service role key can bypass every permission rule.

## 3. Install dependencies

```bash
npm install
```

## 4. Create the first Manager account

There's no sign-up page — accounts are created by a manager from the **Team**
page. For the very first account (before anyone can sign in), run:

```bash
npm run create-manager -- "Your Name" you@example.com "ATemporaryPassword123"
```

Sign in at `/login` with that email/password, then use the **Team** page to
create accounts for the rest of the staff and the owner(s).

## 5. Run it locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 6. Import the existing Excel task board (optional, one-time)

1. In Excel: **File → Save As → CSV (Comma delimited)**.
2. Sign in as the manager, go to **Import**, and upload the CSV.
3. Match your columns (ID / Task / Assigned to / Due date / Status / Remarks)
   — the app guesses these automatically from common header names.
4. Review the preview: unrecognized statuses, unmatched staff names, and
   unreadable dates are flagged (never silently guessed) so you can fix them
   before or after import.
5. Confirm import. A sample file is included at
   [`sample-data/example-tasks.csv`](sample-data/example-tasks.csv) if you
   want to try the flow before using real data.

## 7. Deploy

Push this repo to GitHub and import it into [Vercel](https://vercel.com).
Add the same three environment variables from `.env.local` in the Vercel
project settings, then deploy. Owners can then open the Vercel URL from
anywhere to check on the park.

---

## How permissions work

Every role check exists in **two places**:

1. **The UI** — for a good experience (hiding buttons someone can't use).
2. **The database** — via Row Level Security policies and a handful of
   `SECURITY DEFINER` SQL functions (see `supabase/schema.sql`). Staff can
   only ever touch their own assigned tasks; only an owner can approve a
   task; only a manager can create, edit, or archive tasks. This is enforced
   even if someone bypasses the UI entirely (e.g. calling the API directly).

## Project structure

```
src/app/(app)/        Authenticated pages (dashboard, tasks, owner, team, import)
src/app/login/        Sign-in page
src/components/ui/    Design system (Button, Badge, Overlay/Modal, Toast, …)
src/components/tasks/ Task-specific components (TaskCard, TaskForm, …)
src/lib/actions/      Server actions — all writes go through these
src/lib/queries.ts    Server-side reads
supabase/schema.sql   Database schema, RLS policies, RPC functions
supabase/storage.sql  Evidence file storage bucket + policies
```

## What's deliberately not here (v1)

Payroll, accounting, a full CRM, inventory/ERP, attendance tracking, chat,
payments, or complex analytics. This is a task board, not an ERP — see the
product brief for the full reasoning. Multi-branch support is present in the
data model (`branch_id` on every table) but not yet exposed in the UI —
today there is only Bhubaneswar.
