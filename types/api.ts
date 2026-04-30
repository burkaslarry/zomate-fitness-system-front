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
};

export type BranchDto = {
  id: number;
  name: string;
  address: string;
  code: string;
  active: boolean;
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
