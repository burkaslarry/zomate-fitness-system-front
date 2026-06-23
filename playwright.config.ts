/**
 * [F006][S005]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: Playwright runner configuration
 * Logic: Local dev server for loop specs; optional E2E_BASE_URL for remote preview.
 */

import { defineConfig, devices } from "@playwright/test";

const remoteBase = process.env.E2E_BASE_URL?.trim();
const isExplicitRemote = Boolean(
  remoteBase && !remoteBase.includes("127.0.0.1") && !remoteBase.includes("localhost")
);
const PORT = process.env.PLAYWRIGHT_PORT ?? "3000";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer:
    isExplicitRemote || process.env.PLAYWRIGHT_SKIP_WEBSERVER
      ? undefined
      : {
          command: `npm run dev -- -p ${PORT}`,
          url: `http://127.0.0.1:${PORT}`,
          reuseExistingServer: true,
          timeout: 120_000
        },
  use: {
    baseURL: remoteBase || process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  }
});
