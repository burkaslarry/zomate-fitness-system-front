"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";

export type DemoStudent = {
  id: number;
  name: string;
  phone: string;
  remainingCredits: number;
  pin: string;
  membershipType?: "new" | "renewal";
  englishName?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  coachName?: string;
  plan?: "10" | "30";
  paymentMethod?: string;
  notes?: string;
};

export type DemoExpense = {
  id: number;
  category: "Rent" | "Staff" | "Utilities" | "Equipment" | "Other";
  amount: number;
  date: string;
  receiptImage?: string;
};

export type DemoWhatsAppLog = {
  id: number;
  recipient: string;
  message: string;
  timestamp: string;
  status: "Delivered" | "Pending" | "Failed";
};

type DemoStateContextType = {
  students: DemoStudent[];
  expenses: DemoExpense[];
  whatsappLogs: DemoWhatsAppLog[];
  checkinsCount: number;
  totalExpenses: number;
  addExpense: (expense: Omit<DemoExpense, "id">) => void;
  addStudent: (student: Omit<DemoStudent, "id">) => DemoStudent;
  updateStudent: (id: number, patch: Partial<DemoStudent>) => void;
  deleteStudent: (id: number) => void;
  appendWhatsAppLog: (log: Omit<DemoWhatsAppLog, "id" | "timestamp">) => void;
  markCheckin: (studentName: string, remainingCredits?: number) => void;
};

const seedStudents: DemoStudent[] = [
  { id: 1, name: "Larry Lo", phone: "+85291234567", remainingCredits: 10, pin: "12345" },
  { id: 2, name: "Mandy Chan", phone: "+85292345678", remainingCredits: 8, pin: "12345" },
  { id: 3, name: "Jason Wong", phone: "+85293456789", remainingCredits: 12, pin: "12345" },
  { id: 4, name: "Ivy Lam", phone: "+85294567890", remainingCredits: 6, pin: "12345" },
  { id: 5, name: "Kenny Yip", phone: "+85295678901", remainingCredits: 9, pin: "12345" },
  { id: 6, name: "Carmen Ho", phone: "+85296789012", remainingCredits: 7, pin: "12345" },
  { id: 7, name: "Peter Ng", phone: "+85297890123", remainingCredits: 11, pin: "12345" },
  { id: 8, name: "Angel Lee", phone: "+85298901234", remainingCredits: 5, pin: "12345" },
  { id: 9, name: "Brian Tse", phone: "+85290011223", remainingCredits: 13, pin: "12345" },
  { id: 10, name: "Zoey Mak", phone: "+85291122334", remainingCredits: 10, pin: "12345" }
];

const seedExpenses: DemoExpense[] = [
  { id: 1, category: "Rent", amount: 28000, date: "2026-04-01" },
  { id: 2, category: "Staff", amount: 12500, date: "2026-04-08" },
  { id: 3, category: "Utilities", amount: 3800, date: "2026-04-13" },
  { id: 4, category: "Equipment", amount: 6900, date: "2026-04-16" },
  { id: 5, category: "Other", amount: 2200, date: "2026-04-20" }
];

const seedLogs: DemoWhatsAppLog[] = [
  {
    id: 1,
    recipient: "+85291234567",
    message: "Welcome Larry Lo, your onboarding is confirmed.",
    timestamp: "2026-04-20T10:10:00.000Z",
    status: "Delivered"
  },
  {
    id: 2,
    recipient: "+85292345678",
    message: "Check-in success. Remaining credits: 7.",
    timestamp: "2026-04-21T09:20:00.000Z",
    status: "Delivered"
  },
  {
    id: 3,
    recipient: "+85293456789",
    message: "Your class starts in 30 mins.",
    timestamp: "2026-04-22T17:00:00.000Z",
    status: "Delivered"
  }
];

const DemoStateContext = createContext<DemoStateContextType | null>(null);

export function DemoStateProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<DemoStudent[]>(seedStudents);
  const [expenses, setExpenses] = useState<DemoExpense[]>(seedExpenses);
  const [whatsappLogs, setWhatsappLogs] = useState<DemoWhatsAppLog[]>(seedLogs);
  const [checkinsCount, setCheckinsCount] = useState(36);

  const totalExpenses = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);

  function addExpense(expense: Omit<DemoExpense, "id">) {
    setExpenses((prev) => [{ ...expense, id: Date.now() }, ...prev]);
  }

  function addStudent(student: Omit<DemoStudent, "id">) {
    const next = { ...student, id: Date.now() };
    setStudents((prev) => [next, ...prev]);
    return next;
  }

  function updateStudent(id: number, patch: Partial<DemoStudent>) {
    setStudents((prev) => prev.map((student) => (student.id === id ? { ...student, ...patch } : student)));
  }

  function deleteStudent(id: number) {
    setStudents((prev) => prev.filter((student) => student.id !== id));
  }

  function appendWhatsAppLog(log: Omit<DemoWhatsAppLog, "id" | "timestamp">) {
    setWhatsappLogs((prev) => [
      {
        ...log,
        id: Date.now(),
        timestamp: new Date().toISOString()
      },
      ...prev
    ]);
  }

  function markCheckin(studentName: string, remainingCredits?: number) {
    setCheckinsCount((prev) => prev + 1);
    if (typeof remainingCredits === "number") {
      setStudents((prev) =>
        prev.map((student) => (student.name.toLowerCase() === studentName.toLowerCase() ? { ...student, remainingCredits } : student))
      );
    }
  }

  return (
    <DemoStateContext.Provider
      value={{
        students,
        expenses,
        whatsappLogs,
        checkinsCount,
        totalExpenses,
        addExpense,
        addStudent,
        updateStudent,
        deleteStudent,
        appendWhatsAppLog,
        markCheckin
      }}
    >
      {children}
    </DemoStateContext.Provider>
  );
}

export function useDemoState() {
  const ctx = useContext(DemoStateContext);
  if (!ctx) {
    throw new Error("useDemoState must be used within DemoStateProvider");
  }
  return ctx;
}
