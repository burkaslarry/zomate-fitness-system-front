import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const buildDate =
  process.env.NEXT_PUBLIC_BUILD_DATE?.trim() ||
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_DATE: buildDate
  },
  typedRoutes: false,
  /** Playwright / LAN hits dev server as 127.0.0.1 — avoid Turbopack cross-origin HMR block */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async redirects() {
    return [{ source: "/renewal", destination: "/regCourse", permanent: true }];
  }
};

export default nextConfig;
