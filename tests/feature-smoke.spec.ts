import { expect, test } from "@playwright/test";

test.describe("Feature route smoke checks", () => {
  test("student portal home exposes F01-F03 entries", async ({ page }) => {
    await page.goto("/student");

    await expect(page.getByRole("heading", { name: "學生" })).toBeVisible();
    await expect(page.getByRole("link", { name: "新學生登記 · 健康聲明" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Membership Renewal Form · 續會加堂" })).toBeVisible();
    await expect(page.getByRole("link", { name: "智能 QR 簽到（掃碼 → 揀名 → PIN）" })).toBeVisible();
    await expect(page.getByRole("link", { name: "試堂／加堂（示範）" })).toBeVisible();
  });

  test("admin route requires auth and redirects to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "後台登入" })).toBeVisible();
  });
});
