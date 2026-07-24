/**
 * [F007][S003]
 * Demo: Master admin + clerk + coach access rights — system account CRUD
 * Record against production front; first frame holds on loaded login screen (no blank white).
 */

import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.E2E_BASE_URL ?? "https://zomate-fitness-system-front.vercel.app").replace(/\/$/, "");
const API = (process.env.E2E_API_BASE ?? "https://zomate-fitness-system-back.onrender.com").replace(/\/$/, "");
const DOCS_OUT = path.join(__dirname, "../../docs");

const CLERK_USER = "clerk";
const CLERK_PASS = "123456789";

test.use({
  viewport: { width: 1280, height: 720 },
  video: { mode: "on", size: { width: 1280, height: 720 } },
  launchOptions: { slowMo: 280 },
  actionTimeout: 25_000
});

async function warmLoginFrame(page: Page) {
  await page.goto(`${BASE}/login?logout=1`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "後台登入" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByLabel("帳號")).toBeVisible();
  await page.waitForTimeout(2800);
}

async function staffLogin(page: Page, username: string, password: string, landing: RegExp) {
  await page.getByLabel("帳號").fill(username);
  await page.getByLabel("密碼").fill(password);
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page.waitForURL(landing, { timeout: 45_000 });
  await page.waitForTimeout(1200);
}

async function masterToken(): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "masterzoe", password: "12345678" })
  });
  if (!res.ok) throw new Error(`master login failed: ${res.status}`);
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function prepClerkAccount() {
  const token = await masterToken();
  const listRes = await fetch(`${API}/api/admin/system-users`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (listRes.status === 404) return false;
  if (!listRes.ok) throw new Error(`list system users failed: ${listRes.status}`);
  const users = (await listRes.json()) as Array<{ id: number; username: string; is_active: boolean }>;
  const existing = users.find((u) => u.username === CLERK_USER);
  if (existing?.is_active) {
    await fetch(`${API}/api/admin/system-users/${existing.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
  }
  return true;
}

test.describe("Access rights demo recordings", () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000);
    const health = await fetch(`${API}/api/health`);
    if (!health.ok) throw new Error("Backend health check failed");
    const rights = await fetch(`${API}/api/admin/access-rights`, {
      headers: { Authorization: `Bearer ${await masterToken()}` }
    });
    if (rights.status === 404) {
      throw new Error("Access rights API not deployed yet — wait for Render prod/1.15");
    }
  });

  test("admin — master adds clerk account + access matrix", async ({ page }) => {
    test.setTimeout(240_000);
    const shouldCreate = await prepClerkAccount();

    await warmLoginFrame(page);
    await staffLogin(page, "masterzoe", "12345678", /\/admin/);

    await page.getByRole("link", { name: "系統帳號 · Access Rights" }).click();
    await page.waitForURL("**/admin/system-users**", { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /系統帳號 · Access Rights/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Access Rights 表" })).toBeVisible();
    await page.waitForTimeout(1500);

    await expect(page.getByRole("heading", { name: "Access Rights 表" })).toBeVisible();
    await page.getByText("Masteradmin").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);

    if (shouldCreate) {
      await page.getByPlaceholder("coachfunglo").fill(CLERK_USER);
      await page.locator('input[type="password"]').first().fill(CLERK_PASS);
      await page.getByRole("combobox").first().selectOption("CLERK");
      await page.getByRole("button", { name: "建立帳號" }).click();
      await expect(page.getByText("已建立帳號，對方可以登入開波。")).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("li").filter({ hasText: CLERK_USER }).first()).toBeVisible();
      await page.waitForTimeout(1800);
    } else {
      await expect(page.locator("li").filter({ hasText: CLERK_USER }).first()).toBeVisible();
      await page.waitForTimeout(1200);
    }

    await page.goto(`${BASE}/login?logout=1`);
    await warmLoginFrame(page);
    await staffLogin(page, CLERK_USER, CLERK_PASS, /\/admin/);
    await expect(page.getByRole("link", { name: "學生名單" })).toBeVisible();
    await expect(page.locator("[data-admin-sidebar]").getByRole("link", { name: "教練" })).toHaveCount(0);
    await expect(page.locator("[data-admin-sidebar]").getByRole("link", { name: "銷售與分期" })).toHaveCount(0);
    await page.waitForTimeout(2500);
  });

  test("coach — PT limited navigation", async ({ page }) => {
    test.setTimeout(180_000);

    await warmLoginFrame(page);
    await staffLogin(page, "coachdemo", "12347890", /\/coach-portal/);
    await expect(page.getByRole("heading", { name: "教練工作台" })).toBeVisible({ timeout: 20_000 });
    await page.goto(`${BASE}/coach-portal?tab=schedule`);
    await expect(page.getByText(/日曆 · 學員上堂|學員排期上堂/)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);

    await page.goto(`${BASE}/login?logout=1`);
    await warmLoginFrame(page);
    await staffLogin(page, "coachdemo", "12347890", /\/coach-portal/);
    await page.goto(`${BASE}/admin`);
    await expect(page.getByText(/此頁面僅供|403|Role not allowed|後台登入|教練/i).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2500);
  });

  test.afterEach(async ({}, testInfo) => {
    const videoPath = path.join(testInfo.outputDir, "video.webm");
    if (!fs.existsSync(videoPath)) return;
    fs.mkdirSync(DOCS_OUT, { recursive: true });
    const destName = testInfo.title.includes("admin")
      ? "access-rights-admin-demo.webm"
      : "access-rights-coach-demo.webm";
    fs.copyFileSync(videoPath, path.join(DOCS_OUT, destName));
  });
});
