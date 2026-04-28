/** @feature [F02.3][F03.1][F03.2][F03.3][F04.1][F04.2]
 *
 * In-memory mock backing Next Route Handlers when FastAPI / Postgres are offline.
 * Align field names with FastAPI schemas where possible (full_name, lesson_balance, pin_code).
 */

import type { CourseSaleRow } from "./types/monthly-sales-report";
import type { ExpenseRowValidated, SessionLedgerEntryValidated } from "./schemas/report";

export type MockStudent = {
  id: number;
  full_name: string;
  phone: string;
  hkid: string;
  lesson_balance: number;
  pin_code: string;
  membership_expiry_iso: string;
  package_sessions: 10 | 30;
  email?: string;
};

function randomPin(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

const seedSales: CourseSaleRow[] = [
  {
    date: "2026-04-02",
    clientName: "Chan Tai Man",
    courseType: "PT 10",
    amount: 8800,
    coachName: "Coach A",
    paymentStatus: "PAID_FULL",
    installmentStatus: "NONE"
  },
  {
    date: "2026-04-18",
    clientName: "Lee Siu Ming",
    courseType: "PT 30",
    amount: 22800,
    coachName: "Coach B",
    paymentStatus: "INSTALLMENT_ACTIVE",
    installmentStatus: "ACTIVE"
  },
  {
    date: "2026-04-22",
    clientName: "Wong Ka Yan",
    courseType: "Trial → PT 10",
    amount: 1280,
    coachName: "Coach A",
    paymentStatus: "PENDING",
    installmentStatus: "NONE"
  }
];

const exp = new Date();
exp.setMonth(exp.getMonth() + 3);

let students: MockStudent[] = [
  {
    id: 1,
    full_name: "Larry Lo",
    phone: "+85291234567",
    hkid: "A1234563",
    lesson_balance: 10,
    pin_code: "12345",
    membership_expiry_iso: exp.toISOString(),
    package_sessions: 10
  },
  {
    id: 2,
    full_name: "Mandy Chan",
    phone: "+85292345678",
    hkid: "B2345672",
    lesson_balance: 8,
    pin_code: "12345",
    membership_expiry_iso: exp.toISOString(),
    package_sessions: 10
  },
  {
    id: 3,
    full_name: "Jason Wong",
    phone: "+85293456789",
    hkid: "C3456781",
    lesson_balance: 11,
    pin_code: "12345",
    membership_expiry_iso: exp.toISOString(),
    package_sessions: 30
  },
  {
    id: 4,
    full_name: "Demo Student",
    phone: "+85290000001",
    hkid: "D4567890",
    lesson_balance: 8,
    pin_code: "90210",
    membership_expiry_iso: exp.toISOString(),
    package_sessions: 10
  }
];

let nextId = 5;

let expenses: ExpenseRowValidated[] = [
  {
    id: "e1",
    category: "Rent",
    amount: 28000,
    date: "2026-04-01",
    memo: "Studio rent",
    invoiceRef: "INV-R-001"
  },
  {
    id: "e2",
    category: "Utilities",
    amount: 1200,
    date: "2026-04-05",
    memo: "Electricity"
  }
];

export type CoachAttendanceRow = {
  coachName: string;
  month: string;
  classesTaught: number;
  hoursOnFloor: number;
  grossPayHkd: number;
};

let coachAttendance: CoachAttendanceRow[] = [
  { coachName: "Coach A", month: "2026-04", classesTaught: 42, hoursOnFloor: 56, grossPayHkd: 25200 },
  { coachName: "Coach B", month: "2026-04", classesTaught: 38, hoursOnFloor: 48, grossPayHkd: 21600 }
];

let ledger: SessionLedgerEntryValidated[] = [
  {
    studentName: "Larry Lo",
    sessionStartIso: new Date().toISOString(),
    reason: "attended",
    notes: "Mock seed · ledger"
  }
];

function normalizePhone(p: string): string {
  return p.replace(/\s+/g, "");
}

export const mockApiStore = {
  get students() {
    return students;
  },
  get expenses() {
    return expenses;
  },
  get coachAttendance() {
    return coachAttendance;
  },
  get ledger() {
    return ledger;
  },
  get sales(): CourseSaleRow[] {
    return seedSales;
  },

  searchStudents(q: string): MockStudent[] {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(t) ||
        normalizePhone(s.phone).includes(normalizePhone(t)) ||
        s.phone.toLowerCase().includes(t)
    );
  },

  registerStudent(input: Omit<MockStudent, "id" | "pin_code"> & { pin_code?: string }): MockStudent {
    const pin = input.pin_code ?? randomPin();
    const row: MockStudent = {
      ...input,
      id: nextId++,
      pin_code: pin
    };
    students = [...students, row];
    return row;
  },

  findById(id: number): MockStudent | undefined {
    return students.find((s) => s.id === id);
  },

  findByPhone(phone: string): MockStudent | undefined {
    const n = normalizePhone(phone);
    return students.find((s) => normalizePhone(s.phone) === n);
  },

  checkIn(opts: { student_id?: number; phone?: string; pin_code: string }): MockStudent | null {
    let s: MockStudent | undefined;
    if (opts.student_id != null) s = mockApiStore.findById(opts.student_id);
    if (!s && opts.phone) s = mockApiStore.findByPhone(opts.phone);
    if (!s) return null;
    if (s.pin_code !== opts.pin_code.trim()) return null;
    if (s.lesson_balance <= 0) return null;
    const lesson_balance = s.lesson_balance - 1;
    students = students.map((row) =>
      row.id === s!.id ? { ...row, lesson_balance } : row
    );
    const updated = { ...s!, lesson_balance };
    ledger = [
      {
        studentName: updated.full_name,
        sessionStartIso: new Date().toISOString(),
        reason: "attended",
        notes: "Check-in mock · PIN verified"
      },
      ...ledger
    ];
    return updated;
  },

  appendExpense(row: Omit<ExpenseRowValidated, "id">): ExpenseRowValidated {
    const id = `e${expenses.length + 1}-${Date.now()}`;
    const full = { ...row, id };
    expenses = [...expenses, full];
    return full;
  },

  appendLedger(entry: SessionLedgerEntryValidated): void {
    ledger = [entry, ...ledger];
  }
};
