import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
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
