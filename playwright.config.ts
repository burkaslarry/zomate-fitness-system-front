import { defineConfig } from "@playwright/test";

const remoteBase = process.env.E2E_BASE_URL?.trim();
/** Remote = production/preview URL (not local loopback). Local server is started automatically otherwise. */
const isExplicitRemote = Boolean(
  remoteBase && !remoteBase.includes("127.0.0.1") && !remoteBase.includes("localhost")
);

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: isExplicitRemote
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 120_000
      },
  use: {
    baseURL: remoteBase || "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  }
});
