/**
 * [F008][S007]
 * Feature: Coach Session Management
 * Step: 教練課堂排程 board (mock)
 * Logic: Deterministic sample sessions for all_coaches / day / date-range queries.
 */

import { NextResponse } from "next/server";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function hkToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(new Date());
}

function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function weekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

type MockCoach = {
  id: number;
  name: string;
  branch: string;
  category: string;
  title: string;
  slot: { start: string; end: string };
  students: { id: number; name: string; phone: string }[];
};

const COACHES: MockCoach[] = [
  {
    id: 1,
    name: "Coach A",
    branch: "銅鑼灣",
    category: "泰拳",
    title: "PT 套餐 A",
    slot: { start: "10:00", end: "11:00" },
    students: [
      { id: 1, name: "Larry Lo", phone: "+85291234567" },
      { id: 2, name: "Mandy Chan", phone: "+85292345678" }
    ]
  },
  {
    id: 2,
    name: "Coach B",
    branch: "尖沙咀",
    category: "健身",
    title: "PT 套餐 B",
    slot: { start: "14:00", end: "15:00" },
    students: [{ id: 3, name: "Jason Wong", phone: "+85293456789" }]
  },
  {
    id: 3,
    name: "Coach C",
    branch: "旺角",
    category: "拳擊",
    title: "Group Class",
    slot: { start: "19:00", end: "20:00" },
    students: [{ id: 4, name: "Sample Student", phone: "+85290000001" }]
  }
];

function sessionsForRange(from: string, to: string, today: string, coachId: number | null): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  let day = from;
  let index = 0;
  while (day <= to && index < 93) {
    const dow = weekday(day);
    if (dow !== 0) {
      for (const coach of COACHES) {
        if (coachId != null && coach.id !== coachId) continue;
        if (coach.id === 3 && dow !== 2 && dow !== 4) continue;
        const student = coach.students[index % coach.students.length];
        rows.push({
          enrollment_id: 9000 + coach.id * 100 + index,
          student_id: student.id,
          student_name: student.name,
          student_phone: student.phone,
          coach_id: coach.id,
          coach_name: coach.name,
          category_id: coach.id,
          category_name: coach.category,
          session_date: day,
          start_time: coach.slot.start,
          end_time: coach.slot.end,
          branch_id: coach.id,
          branch_name: coach.branch,
          checkin_pin: "12345",
          coach_time_confirmed: !(coach.id === 3 && index % 6 === 0),
          attendance_status: day < today ? "已簽到" : "未簽到",
          course_title: coach.title,
          lesson_no: (index % 10) + 1,
          total_lessons: 10,
          original_session_date: day,
          session_override: null
        });
      }
    }
    day = addDays(day, 1);
    index += 1;
  }
  rows.sort((a, b) =>
    String(a.session_date).localeCompare(String(b.session_date)) ||
    String(a.start_time).localeCompare(String(b.start_time)) ||
    String(a.coach_name).localeCompare(String(b.coach_name))
  );
  return rows;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.includes("mock-token-dev")) return unauthorized();

  const params = new URL(req.url).searchParams;
  const allCoaches = params.get("all_coaches") === "true";
  const coachParam = params.get("coach_id");
  const coachId = allCoaches ? null : coachParam ? Number(coachParam) : 1;
  const today = hkToday();
  const day = params.get("day");
  const from = params.get("from_date") ?? day ?? today;
  const to = params.get("to_date") ?? day ?? from;

  return NextResponse.json(sessionsForRange(from, to, today, coachId));
}
