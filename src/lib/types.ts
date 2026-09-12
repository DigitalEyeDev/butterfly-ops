// Shared domain types — kept in one place so the UI, validation, and
// database enums never drift apart.

export type UserRole = "manager" | "staff" | "owner" | "receptionist";

export const TASK_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "AWAITING_APPROVAL",
  "CHANGES_REQUESTED",
  "APPROVED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  AWAITING_APPROVAL: "Awaiting approval",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export interface Branch {
  id: string;
  name: string;
  code: string;
  attendance_lat: number | null;
  attendance_lng: number | null;
  attendance_radius_m: number;
  expected_shift_minutes: number;
  lunch_allowed_minutes: number;
  expected_start_time: string;
}

export const ACCOUNT_STATUSES = ["ACTIVE", "DEACTIVATED", "REMOVED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: "Active",
  DEACTIVATED: "Deactivated",
  REMOVED: "Removed",
};

export interface Department {
  id: string;
  branch_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface Profile {
  id: string;
  branch_id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  status: AccountStatus;
  removed_at?: string | null;
  email?: string;
  department_id?: string | null;
  department?: Department | null;
}

export interface Category {
  id: string;
  branch_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface Task {
  id: string;
  display_id: number;
  branch_id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  requires_evidence: boolean;
  manager_remarks: string | null;
  staff_remarks: string | null;
  owner_remarks: string | null;
  legacy_excel_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  submitted_for_approval_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  // joined fields (populated by the queries that need them)
  category?: Category | null;
  assignee?: Profile | null;
  creator?: Profile | null;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  actor_id: string | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  remark: string | null;
  created_at: string;
  actor?: Profile | null;
}

export interface Evidence {
  id: string;
  task_id: string;
  uploaded_by: string | null;
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  url?: string;
}

export interface Approval {
  id: string;
  task_id: string;
  decided_by: string;
  decision: "APPROVED" | "CHANGES_REQUESTED";
  remark: string | null;
  created_at: string;
}

// =========================================================================
// Attendance & Staff Presence
// =========================================================================

export const ATTENDANCE_EVENT_TYPES = ["CLOCK_IN", "LUNCH_START", "LUNCH_END", "CLOCK_OUT"] as const;
export type AttendanceEventType = (typeof ATTENDANCE_EVENT_TYPES)[number];

// Deliberately small — see the comment in supabase/schema.sql. "Lunch
// exceeded", "missing clock-out", and "late arrival" are computed from
// timestamps, not stored as states.
export const ATTENDANCE_RECORD_STATUSES = ["NOT_STARTED", "PRESENT", "ON_LUNCH", "CLOCKED_OUT"] as const;
export type AttendanceRecordStatus = (typeof ATTENDANCE_RECORD_STATUSES)[number];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceRecordStatus, string> = {
  NOT_STARTED: "Not clocked in",
  PRESENT: "Present",
  ON_LUNCH: "On lunch",
  CLOCKED_OUT: "Clocked out",
};

export const LOCATION_STATUSES = [
  "VERIFIED",
  "OUTSIDE_ZONE",
  "LOCATION_UNCERTAIN",
  "LOCATION_PERMISSION_DENIED",
  "LOCATION_UNAVAILABLE",
  "ZONE_NOT_CONFIGURED",
] as const;
export type LocationStatus = (typeof LOCATION_STATUSES)[number];

export const LOCATION_STATUS_LABELS: Record<LocationStatus, string> = {
  VERIFIED: "Verified at park",
  OUTSIDE_ZONE: "Outside attendance zone",
  LOCATION_UNCERTAIN: "GPS accuracy too low",
  LOCATION_PERMISSION_DENIED: "Location permission denied",
  LOCATION_UNAVAILABLE: "Location unavailable",
  ZONE_NOT_CONFIGURED: "Attendance zone not set up",
};

export interface AttendanceRecord {
  id: string;
  branch_id: string;
  user_id: string;
  attendance_date: string;
  status: AttendanceRecordStatus;
  expected_shift_minutes: number;
  lunch_allowed_minutes: number;
  created_at: string;
  updated_at: string;
  user?: Profile | null;
  events?: AttendanceEvent[];
}

export interface AttendanceEvent {
  id: string;
  attendance_record_id: string;
  branch_id: string;
  user_id: string;
  event_type: AttendanceEventType;
  event_timestamp: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  distance_from_park_meters: number | null;
  location_status: LocationStatus;
  evidence_image_path: string | null;
  evidence_image_url?: string;
  created_at: string;
}

export interface AttendanceAdjustment {
  id: string;
  attendance_record_id: string;
  performed_by: string;
  reason: string;
  previous_status: AttendanceRecordStatus | null;
  new_status: AttendanceRecordStatus | null;
  created_at: string;
  performer?: Profile | null;
}

// =========================================================================
// Reception Operations
// =========================================================================

// One report per branch per calendar day — not per receptionist — since
// the front desk reports one set of park-wide numbers per day regardless
// of who's on shift (see supabase/reception.sql).
export const RECEPTION_REPORT_STATUSES = ["DRAFT", "SUBMITTED", "CORRECTION_REQUESTED", "VERIFIED"] as const;
export type ReceptionReportStatus = (typeof RECEPTION_REPORT_STATUSES)[number];

export const RECEPTION_STATUS_LABELS: Record<ReceptionReportStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  CORRECTION_REQUESTED: "Correction requested",
  VERIFIED: "Verified",
};

export interface ReceptionReport {
  id: string;
  branch_id: string;
  business_date: string;
  status: ReceptionReportStatus;
  visitors_count: number | null;
  tickets_sold: number | null;
  socks_sold: number | null;
  review_count: number | null;
  remarks: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  correction_reason: string | null;
  // joined fields
  creator?: Profile | null;
  submitter?: Profile | null;
  reviewer?: Profile | null;
  evidence?: ReceptionReviewEvidence[];
  updates?: ReceptionReportUpdate[];
}

export interface ReceptionReportUpdate {
  id: string;
  report_id: string;
  actor_id: string | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  remark: string | null;
  created_at: string;
  actor?: Profile | null;
}

export interface ReceptionReviewEvidence {
  id: string;
  report_id: string;
  uploaded_by: string | null;
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  url?: string;
}
