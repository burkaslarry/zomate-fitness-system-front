/**
 * [F006][S001]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: Tailwind theme and content paths.
 */

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        /** Single warm theme — do not add dark-mode branches; use tokens only. */
        canvas: "#FDFAF9",
        surface: "#F7F2F1",
        primary: "#E8A598",
        ink: "#2D2422"
      }
    }
  },
  plugins: []
};

export default config;
