/**
 * [F005][S003]
 * Full demo: Gary (full pay Yoga) + Jessie (3期 Pilates) under fung lo —
 * register, coach reg-course, schedule, check-in, admin WhatsApp remind + receipt upload.
 */

import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const FIXTURE = path.join(__dirname, "fixtures", "demo-gary-jessie-state.json");
const state = fs.existsSync(FIXTURE)
  ? (JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as {
      coach_username: string;
      coach_password: string;
      gary: { full_name: string; phone: string; hkid: string };
      jessie: { full_name: string; phone: string; hkid: string };
      receipt_fixture: string;
    })
  : {
      coach_username: "funglo",
      coach_password: "12347890",
      gary: { full_name: "Gary Man", phone: "98764301", hkid: "G8764301" },
      jessie: { full_name: "Jessie Yeung", phone: "98764302", hkid: "J8764302" },
      receipt_fixture: path.join(__dirname, "../../../docs/memberform/IMG_2788.png")
    };

const RECEIPT_SOURCE = path.join(__dirname, "../../../docs/memberform/IMG_2788.png");
const RECEIPT_DEMO = path.join(__dirname, "../../../docs/memberform/IMG_2788-receipt-demo.png");
const RECEIPT_PATH = fs.existsSync(RECEIPT_DEMO)
  ? RECEIPT_DEMO
  : fs.existsSync(state.receipt_fixture)
    ? state.receipt_fixture
    : RECEIPT_SOURCE;

const API_BASE = (process.env.E2E_API_BASE ?? "https://zomate-fitness-system-back.onrender.com").replace(/\/$/, "");

const PAUSE = 900;

test.use({
  viewport: { width: 1280, height: 720 },
  video: { mode: "on", size: { width: 1280, height: 720 } },
  launchOptions: { slowMo: 320 },
  actionTimeout: 20_000
});

async function pause(page: Page, ms = PAUSE) {
  await page.waitForTimeout(ms);
}

async function login(page: Page, username: string, password: string) {
  await page.goto("/login?logout=1");
  await page.getByLabel("帳號").fill(username);
  await page.getByLabel("密碼").fill(password);
  await page.getByRole("button", { name: "登入", exact: true }).click();
}

async function drawSignature(page: Page) {
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const box = await canvas.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + 24, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 24, box.y + box.height - 30, { steps: 8 });
  await page.mouse.up();
}

async function studentExists(page: Page, phone: string): Promise<boolean> {
  const res = await page.request.get(`${API_BASE}/api/public/student-search?q=${encodeURIComponent(phone)}`);
  if (!res.ok()) return false;
  const rows = (await res.json()) as Array<{ phone?: string }>;
  return rows.some((r) => String(r.phone ?? "").replace(/\D/g, "").endsWith(phone));
}

async function resolveStudentId(page: Page, phone: string): Promise<number> {
  const res = await page.request.get(`${API_BASE}/api/public/student-search?q=${encodeURIComponent(phone)}`);
  const rows = (await res.json()) as Array<{ id: number; phone?: string }>;
  const row = rows.find((r) => String(r.phone ?? "").replace(/\D/g, "").endsWith(phone));
  if (!row) throw new Error(`Student not found for phone ${phone}`);
  return row.id;
}

async function lessonBalance(page: Page, phone: string): Promise<number> {
  const res = await page.request.get(`${API_BASE}/api/public/student-search?q=${encodeURIComponent(phone)}`);
  const rows = (await res.json()) as Array<{ lesson_balance?: number; phone?: string }>;
  const row = rows.find((r) => String(r.phone ?? "").replace(/\D/g, "").endsWith(phone));
  return row?.lesson_balance ?? 0;
}

async function fetchCheckinPin(page: Page, studentId: number, categoryHint: string): Promise<string> {
  const res = await page.request.get(`${API_BASE}/api/members/by-id/${studentId}/full`);
  if (!res.ok()) throw new Error(`member full fetch failed for ${studentId}`);
  const data = (await res.json()) as {
    course_checkin_pins?: Array<{
      course_title?: string;
      checkin_pin?: string;
      installment_segments?: Array<{ installment_no: number; pin?: string; paid?: boolean }>;
    }>;
  };
  const pins = data.course_checkin_pins ?? [];
  const match =
    pins.find((p) => (p.course_title ?? "").includes(categoryHint.split(" ")[0] ?? categoryHint)) ??
    pins[pins.length - 1];
  if (!match) throw new Error(`No enrollment PIN for student ${studentId}`);
  const seg = match.installment_segments?.find((s) => s.installment_no === 1 && s.pin);
  return (seg?.pin ?? match.checkin_pin ?? "").trim();
}

async function registerStudent(
  page: Page,
  opts: { fullName: string; phone: string; hkid: string }
) {
  if (await studentExists(page, opts.phone)) {
    return;
  }
  await page.goto("/student/onboard");
  await page.locator('input[name="chinese_name"]').fill(opts.fullName.split(" ")[0] ?? opts.fullName);
  await page.locator('input[name="full_name"]').fill(opts.fullName);
  await page.locator('input[name="hkid"]').fill(opts.hkid);
  await page.getByPlaceholder("12345678").fill(opts.phone);
  await page.locator('input[type="date"]').fill("1992-06-15");
  await page.locator('input[name="emergency_contact_name"]').fill("Emergency Contact");
  await page.locator('input[name="emergency_contact_relationship"]').fill("家人");
  await page.getByPlaceholder("87654321").fill("61234567");
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByText("醫生曾說你有心臟問題")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByText("Step 1 · 選擇教練")).toBeVisible({ timeout: 15_000 });
  const coachSelect = page.locator("select").first();
  const coachOpts = await coachSelect.locator("option").allTextContents();
  const coachPick =
    coachOpts.find((t) => /fung/i.test(t)) ??
    coachOpts.find((t) => t.trim() && !t.includes("請先"));
  if (coachPick) await coachSelect.selectOption({ label: coachPick.trim() });
  await pause(page, 1200);
  const catSelect = page.locator("select").nth(1);
  await expect(catSelect).not.toBeDisabled({ timeout: 15_000 });
  const options = await catSelect.locator("option").allTextContents();
  const pick = options.find((t) => t.trim() && !t.includes("請選")) ?? options[1];
  if (pick) await catSelect.selectOption({ label: pick });
  await page.locator('[data-pdpo-ack] input[type="checkbox"]').check();
  await page.locator('[data-cooling-ack] input[type="checkbox"]').check();
  await page.locator('[data-disclaimer-ack] input[type="checkbox"]').check();
  await drawSignature(page);
  await page.getByRole("button", { name: "提交登記" }).click();
  await expect(page.getByRole("heading", { name: "申請成功" })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "回到主頁" }).click();
  await pause(page);
}

async function coachRegCourse(
  page: Page,
  opts: {
    phone: string;
    categoryLabel: string;
    lessons: string;
    amount: string;
    fullPay: boolean;
    installmentCount?: 2 | 3;
    studentId?: number;
  }
): Promise<string> {
  const balance = await lessonBalance(page, opts.phone);
  if (balance > 0 && opts.studentId) {
    return fetchCheckinPin(page, opts.studentId, opts.categoryLabel);
  }
  await page.goto("/coach-portal/reg-course");
  await page.getByPlaceholder("91234567").fill(opts.phone);
  await page.getByRole("button", { name: "搜尋" }).click();
  await pause(page, 1000);
  await page.locator("label").filter({ hasText: opts.categoryLabel }).first().click();
  await page.locator('input[inputmode="numeric"]').first().fill(opts.lessons);
  await page.getByRole("button", { name: "下一步" }).click();
  await pause(page, 1000);
  await page.getByPlaceholder("HKD").fill(opts.amount);
  if (opts.fullPay) {
    await page.getByText("一次付清（Full pay）").click();
  } else {
    await page.getByText("分期付款（Installment）").click();
    if (opts.installmentCount === 3) {
      await page.getByText("3 期", { exact: true }).click();
    }
  }
  await page.getByRole("radio", { name: "Cash" }).check();
  await page.getByRole("button", { name: "確認報名" }).click();
  await expect(page.getByText("已記錄付款 · 簽到 PIN")).toBeVisible({ timeout: 60_000 });
  const pinEl = page.locator(".font-mono.text-3xl").first();
  const pin = (await pinEl.textContent())?.trim() ?? "";
  await pause(page, 3000);
  return pin;
}

async function scheduleStudentOnCoachPortal(page: Page, studentName: string, startHour = "10") {
  await page.goto("/coach-portal?tab=schedule");
  await expect(page.getByRole("heading", { name: /日曆 · 學員上堂/ })).toBeVisible({ timeout: 30_000 });
  await pause(page, 1200);

  const agendaRow = page.locator("section").filter({ hasText: studentName }).getByText(new RegExp(`\\d{2}:\\d{2}`));
  if ((await agendaRow.count()) > 0) {
    return;
  }

  const pendingChip = page.getByRole("button", { name: new RegExp(`^${studentName}$`) });
  if ((await pendingChip.count()) > 0) {
    await pendingChip.first().click();
  } else {
    await page.getByRole("button", { name: "新增學員上堂時間" }).click();
    await expect(page.getByRole("heading", { name: "揀學員排程" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: new RegExp(studentName) }).first().click();
  }
  await pause(page);
  await page.getByRole("button", { name: "新增學員上堂時間" }).click();
  await expect(page.getByRole("heading", { name: "揀時段排程" })).toBeVisible({ timeout: 15_000 });
  await pause(page);

  await page.getByLabel("開始 · 鐘數").selectOption(startHour);
  await pause(page, 400);
  const minuteSelect = page.getByLabel("開始 · 分鐘");
  const enabledMinute = minuteSelect.locator("option:not([disabled])").first();
  if ((await enabledMinute.count()) > 0) {
    const value = await enabledMinute.getAttribute("value");
    if (value) await minuteSelect.selectOption(value);
  }

  const confirmBtn = page.getByRole("button", { name: "確認排程" });
  await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });
  await confirmBtn.click();
  await expect(page.getByText("排期成功")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "查看學員" }).click();
  await pause(page);
}

async function studentCheckin(page: Page, phone: string, pin: string, studentName: string) {
  await page.goto("/student/checkin");
  await page.getByPlaceholder("91234567").fill(phone);
  await page.getByRole("button", { name: "搜尋" }).click();
  await pause(page);
  await page.getByRole("button", { name: new RegExp(phone) }).click();
  await pause(page);

  const lessonBtn = page.getByRole("button", { name: /Yoga|Pilates|瑜珈|普拉提/ }).first();
  await expect(lessonBtn).toBeVisible({ timeout: 20_000 });
  await lessonBtn.click();
  await expect(page.getByText("步驟 3 · 輸入 PIN 扣堂")).toBeVisible({ timeout: 15_000 });
  await pause(page);

  for (const digit of pin.split("")) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }

  const dialogMsg = page.waitForEvent("dialog", { timeout: 8_000 }).catch(() => null);
  await page.getByRole("button", { name: "確認" }).click();
  const dialog = await dialogMsg;
  if (dialog) {
    await dialog.accept();
    await pause(page, 1200);
    return;
  }

  await expect(
    page.getByText(/簽到成功/).or(page.getByText(/更新後餘額/)).or(page.getByText(new RegExp(`${studentName}.*餘`)))
  ).toBeVisible({ timeout: 30_000 });
  await pause(page, 2500);
}

async function adminReceiptRemind(page: Page, context: BrowserContext, studentId: number) {
  await page.goto(`/admin/students/${studentId}`);
  await expect(page.getByText("簽名圖")).toBeVisible({ timeout: 30_000 });
  await pause(page);
  const waBtn = page.getByRole("button", { name: /WhatsApp 請上傳收據/ });
  const popupPromise = context.waitForEvent("page", { timeout: 12_000 }).catch(() => null);
  await waBtn.click();
  await popupPromise;
  await pause(page, 2000);
}

async function adminUploadReceipt(
  page: Page,
  context: BrowserContext,
  studentId: number,
  expectInstallment: boolean
) {
  await page.goto(`/admin/students/${studentId}`);
  await page.locator("button").filter({ hasText: /^課程記錄$/ }).click();
  await page.getByRole("button", { name: /^上傳收據$/ }).first().click();
  await expect(page.getByLabel("上傳收據（圖片／PDF）")).toBeVisible({ timeout: 10_000 });
  await page.getByLabel("上傳收據（圖片／PDF）").setInputFiles(RECEIPT_PATH);
  await page.getByPlaceholder("例如 7932").fill(expectInstallment ? "3000" : "10000");
  await page.getByPlaceholder("cash / fps / card").fill("cash");
  const courseSelect = page.locator('select[name="course_enrollment_id"]');
  if ((await courseSelect.count()) > 0) {
    const opts = await courseSelect.locator("option").all();
    if (opts.length > 1) await courseSelect.selectOption({ index: 1 });
  }
  await page.getByRole("button", { name: /^上傳收據$/ }).last().click();
  const successTitle = expectInstallment ? "收據已上傳（分期）" : "收據已上傳（全數付款）";
  await expect(page.getByRole("heading", { name: successTitle })).toBeVisible({ timeout: 45_000 });
  await pause(page, 1500);
  const waPopup = context.waitForEvent("page", { timeout: 12_000 }).catch(() => null);
  await page.getByRole("link", { name: /WhatsApp 訊息（學生）/ }).click();
  await waPopup;
  await pause(page, 2000);
  await page.getByRole("button", { name: "完成" }).click();
  await pause(page);
}

test("record Gary + Jessie full demo (fung lo)", async ({ page, context }) => {
  test.setTimeout(1_200_000);

  // ── 1. Register Gary Man & Jessie Yeung (fung lo) ──
  await registerStudent(page, {
    fullName: state.gary.full_name,
    phone: state.gary.phone,
    hkid: state.gary.hkid
  });
  await registerStudent(page, {
    fullName: state.jessie.full_name,
    phone: state.jessie.phone,
    hkid: state.jessie.hkid
  });

  // ── 2. Coach funglo: reg course full pay / installment ──
  await login(page, state.coach_username, state.coach_password);
  await page.waitForURL("**/coach-portal**", { timeout: 45_000 });
  await pause(page);

  const garyId = await resolveStudentId(page, state.gary.phone);
  const jessieId = await resolveStudentId(page, state.jessie.phone);

  const garyPin = await coachRegCourse(page, {
    phone: state.gary.phone,
    studentId: garyId,
    categoryLabel: "Yoga 瑜珈",
    lessons: "10",
    amount: "10000",
    fullPay: true
  });

  const jessiePin = await coachRegCourse(page, {
    phone: state.jessie.phone,
    studentId: jessieId,
    categoryLabel: "Pilates 普拉提",
    lessons: "30",
    amount: "9000",
    fullPay: false,
    installmentCount: 3
  });

  // ── 3. Coach schedule both students ──
  await scheduleStudentOnCoachPortal(page, state.gary.full_name, "9");
  await scheduleStudentOnCoachPortal(page, state.jessie.full_name, "10");

  // ── 4. Student check-in (PIN pad) ──
  await studentCheckin(page, state.gary.phone, garyPin, state.gary.full_name);
  await studentCheckin(page, state.jessie.phone, jessiePin, state.jessie.full_name);

  // ── 5. Admin: WhatsApp 收據未確認 (reminder_student §1) ──
  await login(page, "masterzoe", "12345678");
  await page.waitForURL("**/admin**", { timeout: 45_000 });
  await adminReceiptRemind(page, context, garyId);
  await adminReceiptRemind(page, context, jessieId);

  // ── 6. Upload receipt → success popup → WhatsApp (full pay §25 / 分期 §10) ──
  await adminUploadReceipt(page, context, garyId, false);
  await adminUploadReceipt(page, context, jessieId, true);
});
