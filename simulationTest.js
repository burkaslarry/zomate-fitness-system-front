/**
 * Zomate Fitness - Full System Simulation (local mock state)
 * Happy Path + Edge Case checks.
 */

const state = {
  students: [],
  courses: [],
  expenses: [],
  whatsappLogs: []
};

let idSeq = 1;

function nextId() {
  return idSeq++;
}

function nowIso() {
  return new Date().toISOString();
}

function pushWhatsAppLog(recipient, message, status = "Delivered") {
  state.whatsappLogs.push({
    id: nextId(),
    recipient,
    message,
    timestamp: nowIso(),
    status
  });
}

function registerStudent({ name, phone }) {
  if (!name || !phone) {
    throw new Error("Name and phone are required.");
  }

  const student = {
    id: nextId(),
    name,
    phone,
    remainingCredits: 10,
    pin: "12345"
  };
  state.students.push(student);
  pushWhatsAppLog(student.phone, `Welcome ${student.name}, your PIN is ${student.pin}.`);
  return student;
}

function assignStudentToCourse({ studentId, courseName, date, timeSlot }) {
  const student = state.students.find((s) => s.id === studentId);
  if (!student) {
    throw new Error("Student not found for course assignment.");
  }

  const course = {
    id: nextId(),
    name: courseName,
    date,
    timeSlot,
    assignedStudents: [student.id]
  };
  state.courses.push(course);
  return course;
}

function searchStudentByName(keyword) {
  const t = (keyword || "").trim().toLowerCase();
  return state.students.filter((s) => s.name.toLowerCase().includes(t));
}

function getCurrentCourseForStudent(studentId, timeSlot = "10:00 AM") {
  return state.courses.find((c) => c.timeSlot === timeSlot && c.assignedStudents.includes(studentId)) || null;
}

function checkInByPin({ studentId, pin }) {
  const student = state.students.find((s) => s.id === studentId);
  if (!student) {
    throw new Error("Student not found during check-in.");
  }

  if (pin !== student.pin) {
    return {
      ok: false,
      error: "Incorrect PIN",
      shakeAnimation: true
    };
  }

  student.remainingCredits -= 1;
  pushWhatsAppLog(student.phone, `Check-in success. Remaining credits: ${student.remainingCredits}.`);
  return {
    ok: true,
    remainingCredits: student.remainingCredits
  };
}

function addExpense({ category, amount, date, receiptImage }) {
  if (!category || !amount) {
    throw new Error("Expense category and amount are required.");
  }

  const expense = {
    id: nextId(),
    category,
    amount,
    date,
    receiptImage
  };
  state.expenses.push(expense);
  return expense;
}

function getTotalExpenses() {
  return state.expenses.reduce((sum, item) => sum + item.amount, 0);
}

function runSimulationTest() {
  console.log("=== Zomate Simulation Test Started ===");

  // Edge case: incorrect PIN should fail with shake flag.
  const edgeStudent = registerStudent({ name: "Edge Case", phone: "+85290000000" });
  const edgeFail = checkInByPin({ studentId: edgeStudent.id, pin: "99999" });
  console.log("[Edge Case] Incorrect PIN result:", edgeFail);

  // Step 1: Register Larry Lo.
  const larry = registerStudent({ name: "Larry Lo", phone: "+85291234567" });
  console.log("[Step 1] Registered:", larry);

  // Step 2: Assign Larry to Weight Training at 10:00 AM.
  const course = assignStudentToCourse({
    studentId: larry.id,
    courseName: "Weight Training",
    date: "2026-04-26",
    timeSlot: "10:00 AM"
  });
  console.log("[Step 2] Course assigned:", course);

  // Step 3: Check-in flow -> search Larry -> verify course -> enter pin 12345.
  const searchResults = searchStudentByName("Larry");
  const found = searchResults[0];
  const activeCourse = getCurrentCourseForStudent(found.id, "10:00 AM");
  const checkin = checkInByPin({ studentId: found.id, pin: "12345" });
  console.log("[Step 3] Search result:", found);
  console.log("[Step 3] Current course:", activeCourse);
  console.log("[Step 3] Check-in result:", checkin);

  // Step 4: Log expense HKD 5000 for Rent.
  const expense = addExpense({
    category: "Rent",
    amount: 5000,
    date: "2026-04-26",
    receiptImage: "mock://receipt-rent-5000.png"
  });
  console.log("[Step 4] Expense added:", expense);

  const larryAfter = state.students.find((s) => s.id === larry.id);
  const totalExpenses = getTotalExpenses();

  console.log("\n=== Final Verification ===");
  console.log("Larry remainingCredits (expected 9):", larryAfter.remainingCredits);
  console.log("Total expenses (expected 5000):", totalExpenses);
  console.log("WhatsApp logs count:", state.whatsappLogs.length);

  console.log("\n=== Final State Snapshot ===");
  console.log(
    JSON.stringify(
      {
        students: state.students,
        courses: state.courses,
        expenses: state.expenses,
        whatsappLogs: state.whatsappLogs
      },
      null,
      2
    )
  );

  console.log("=== Zomate Simulation Test Completed ===");
}

runSimulationTest();
