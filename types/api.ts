export type MemberProfile = {
  id: number;
  hkid: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  pin_code: string;
  lesson_balance: number;
  coach_trial_quota_remaining?: number;
  photo_path: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type PackageDto = {
  id: number;
  name: string;
  sessions: number;
  price: number;
  active: boolean;
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

export type CourseCheckinPinRow = {
  course_id: number;
  course_title: string;
  branch_name: string;
  checkin_pin: string;
};

export type CategoryEnrollmentRow = {
  id: number;
  course_category_id: number;
  category_name: string;
  status: string;
  total_lessons: number;
  started_at: string;
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
    name: string;
    coach: string | null;
    amount: number | null;
    payment_method: string | null;
    remaining: number;
    created_at: string;
  }>;
  trial_classes: Array<{
    id: number;
    type: string;
    class_date: string;
    note: string | null;
    created_at: string;
  }>;
  activity_log: Array<{
    id: number;
    type: string;
    detail: string | null;
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
