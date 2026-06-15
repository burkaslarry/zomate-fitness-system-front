/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  /** Playwright / LAN hits dev server as 127.0.0.1 — avoid Turbopack cross-origin HMR block */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async redirects() {
    return [{ source: "/renewal", destination: "/regCourse", permanent: true }];
  }
};

export default nextConfig;
