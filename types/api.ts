/**
 * [F007][S002]
 * Feature: Backend platform (FastAPI & PostgreSQL)
 * Step: (see Logic)
 * Logic: Frontend typings mirroring API DTOs.
 */

export type MemberProfile = {
  id: number;
  hkid: string | null;
  full_name: string;
  phone: string;
  used_mobile_number?: string | null;
  email: string | null;
  date_of_birth?: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  lesson_balance: number;
  coach_trial_quota_remaining?: number;
  photo_path: string | null;
  photo_url: string | null;
  signature_image_url?: string | null;
  is_active: boolean;
  current_course_package_status?: string;
  last_checkin_at?: string | null;
  created_at: string;
};

export type InstallmentSegmentPinDto = {
  installment_no: number;
  lesson_from: number;
  lesson_to: number;
  pin: string;
  /** False until staff marks installment paid (scheduled package PIN gating). */
  paid?: boolean;
};

export type CourseCheckinPinRow = {
  course_id: number;
  course_title: string;
  branch_name: string;
  coach_name?: string;
  scheduled_start?: string;
  series_end_date?: string | null;
  checkin_pin: string;
  installment_segments?: InstallmentSegmentPinDto[];
};

/** Response from POST /api/trial-classes */
export type TrialClassCreateResponse = {
  id: number;
  member: MemberProfile;
  course_checkin_pins?: CourseCheckinPinRow[];
};

export type PackageDto = {
  id: number;
  name: string;
  sessions: number;
  price: number;
  active: boolean;
};

/** Mirrors GET /api/admin/course-categories rows (soft-delete flags vary by backend). */
export type CourseCategoryDto = {
  id: number;
  name: string;
  deleted_at?: string | null;
  is_deleted?: boolean;
  is_active?: boolean;
  created_by_role?: string;
  created_at?: string;
};

export type CoachEnrolledStudentDto = {
  id: number;
  full_name: string;
  phone: string;
};

export type CoachDto = {
  id: number;
  full_name: string;
  phone: string;
  specialty?: string | null;
  active: boolean;
  branch_id: number | null;
  branch_name?: string | null;
  hire_date?: string | null;
  login_username?: string | null;
  enrolled_students?: CoachEnrolledStudentDto[];
  skill_category_ids?: number[];
};

export type CoachSkillsDto = {
  coach_id: number;
  course_category_ids: number[];
};

export type CoachStudentBriefDto = {
  student_id: number;
  full_name: string;
  phone: string;
  lesson_balance: number;
  enrollment_count: number;
  pending_schedule: boolean;
};

export type CoachStudentRecordDto = {
  student_id: number;
  full_name: string;
  phone: string;
  lesson_balance: number;
  enrollments: {
    enrollment_id: number;
    course_title: string;
    scheduled_start: string;
    scheduled_end: string;
    total_lessons: number;
    coach_time_confirmed: boolean;
    payment_status: string;
    installment_status: string;
  }[];
  checkins: { id: number; channel: string; remarks: string | null; created_at: string }[];
  attendance: {
    id: number;
    course_id: number | null;
    course_title: string | null;
    session_calendar_date: string;
    attended_at: string;
  }[];
};

export type CoachRemindPaymentDto = {
  ok: boolean;
  message: string;
  wa_link: string;
  logged: boolean;
};

export type CoachStudentFollowUpDto = {
  student_id: number;
  full_name: string;
  phone: string;
  attendance_status: string;
  next_lesson: string;
  payment_reminder: string | null;
};

export type TrialClassKindDto = {
  id: number;
  code: string;
  label_zh: string;
  sort_order: number;
  active: boolean;
};

export type BranchDto = {
  id: number;
  name: string;
  address: string;
  code: string;
  active: boolean;
  business_start_time?: string;
  business_end_time?: string;
  remarks?: string | null;
};

export type InstallmentPaymentRow = {
  id: number;
  installment_no: number;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: string;
};

export type InstallmentPlanRow = {
  id: number;
  total_installments: number;
  status: string;
  created_at: string;
  payments: InstallmentPaymentRow[];
};

export type CategoryEnrollmentRow = {
  id: number;
  course_category_id: number;
  category_name: string;
  status: string;
  total_lessons: number;
  started_at: string;
  installment_plans?: InstallmentPlanRow[];
};

export type MemberFull = {
  profile: MemberProfile;
  receipts: Array<{
    id: number;
    file_url: string | null;
    amount: number | null;
    payment_method: string | null;
    note: string | null;
    source: string;
    created_at: string;
  }>;
  packages: Array<{
    id: number;
    package_id?: number | null;
    coach_id?: number | null;
    branch_id?: number | null;
    name: string;
    lessons: number;
    coach: string | null;
    amount: number | null;
    payment_method: string | null;
    renewal_date?: string;
    created_at: string;
  }>;
  trial_classes: Array<{
    id: number;
    type: string;
    coach_id?: number | null;
    coach_name?: string | null;
    branch_id?: number | null;
    branch_name?: string | null;
    trial_kind_id?: number | null;
    trial_kind_label_zh?: string | null;
    class_date: string;
    note: string | null;
    created_at: string;
  }>;
  activity_log: Array<{
    id: number;
    type: string;
    ref_id?: number | null;
    created_at: string;
  }>;
  course_checkin_pins?: CourseCheckinPinRow[];
  category_enrollments?: CategoryEnrollmentRow[];
};

export type FinanceSummary = {
  total_income: number;
  total_expense: number;
  net: number;
  txn_count: number;
  by_payment_method: Array<{ key: string; amount: number }>;
  by_branch: Array<{ key: string; amount: number }>;
  by_coach: Array<{ key: string; amount: number }>;
  daily_income: Array<{ date: string; amount: number }>;
};
