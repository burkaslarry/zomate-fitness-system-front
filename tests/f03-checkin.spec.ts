import { expect, test } from "@playwright/test";

test.describe("F03 check-in flow surfaces", () => {
  test("gate bypass query enables step 2 and step 3 UI", async ({ page }) => {
    await page.goto("/student/checkin?gate=1");

    await expect(page.getByRole("heading", { name: "步驟 2 · 搜尋姓名" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "步驟 3 · 輸入 PIN 扣堂" })).toBeVisible();
    await expect(page.getByRole("button", { name: "確認" })).toBeDisabled();
  });

  test("no search result offers quick onboarding link", async ({ page }) => {
    await page.goto("/student/checkin?gate=1");
    await page.getByPlaceholder("輸入姓名或電話一部份…").fill("PLAYWRIGHT-NEW-STUDENT");

    await expect(page.getByText("沒有符合結果")).toBeVisible();
    const quickLink = page.getByRole("link", { name: "即時登記學生" });
    await expect(quickLink).toBeVisible();
    await quickLink.click();

    await expect(page).toHaveURL(/\/student\/onboard\?quickName=/);
    await expect(page.getByRole("heading", { name: "新人入會 · F01" })).toBeVisible();
  });
});
