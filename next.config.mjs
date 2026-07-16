import { readFileSync } from "node:fs";
import { resolveBuildDateHkt, resolveProdVersionLabel } from "./scripts/resolve-prod-version.mjs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const buildDate = resolveBuildDateHkt();
const prodVersion = resolveProdVersionLabel(`v${pkg.version}`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: prodVersion,
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
