import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/types";

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Task title is required")
    .max(200, "Keep the title under 200 characters"),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  category_id: z.string().uuid().optional().or(z.literal("")),
  assigned_to: z
    .string()
    .uuid("Choose who this task is assigned to")
    .optional()
    .or(z.literal("")),
  due_date: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Enter a valid due date"),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  requires_evidence: z.boolean().optional(),
  manager_remarks: z.string().trim().max(4000).optional().or(z.literal("")),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const createUserSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  role: z.enum(["manager", "staff", "owner", "receptionist"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
  department_id: z.string().uuid().optional().or(z.literal("")),
});

export const remarkSchema = z.object({
  remark: z.string().trim().min(1, "Remark can't be empty").max(2000),
});

export const departmentFormSchema = z.object({
  name: z.string().trim().min(1, "Department name is required").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

// Every count is optional at draft time (a partially-filled report is a
// valid draft) but, when present, must be a non-negative integer — the
// submit RPC is what actually requires all four before locking the report.
const nonNegativeCount = z.coerce
  .number()
  .int("Enter a whole number")
  .min(0, "Cannot be negative")
  .optional();

// business_date is deliberately not a field here — like attendance, "today"
// is always derived server-side (see save_reception_draft in
// supabase/reception.sql), never taken from the client/device clock.
export const receptionDraftSchema = z.object({
  visitors_count: nonNegativeCount,
  tickets_sold: nonNegativeCount,
  socks_sold: nonNegativeCount,
  review_count: nonNegativeCount,
  remarks: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const correctionReasonSchema = z.object({
  reason: z.string().trim().min(3, "Explain what needs to be corrected").max(1000),
});

export const attendanceSettingsSchema = z.object({
  attendance_lat: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= -90 && Number(v) <= 90), "Enter a valid latitude"),
  attendance_lng: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180), "Enter a valid longitude"),
  attendance_radius_m: z.coerce.number().int().min(20, "At least 20m").max(2000, "At most 2000m"),
  expected_shift_minutes: z.coerce.number().int().min(60, "At least 1 hour").max(1440, "At most 24 hours"),
  lunch_allowed_minutes: z.coerce.number().int().min(0).max(240),
  expected_start_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM format"),
});

export const adjustAttendanceSchema = z.object({
  new_status: z.enum(["NOT_STARTED", "PRESENT", "ON_LUNCH", "CLOCKED_OUT"]),
  reason: z.string().trim().min(3, "Explain the reason for this adjustment").max(500),
});
