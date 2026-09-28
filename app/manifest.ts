/**
 * [F006][S005]
 * Feature: Mobile PWA shell
 * Step: Install metadata for coach, clerk and student phones.
 * Logic: Launch the responsive app as a standalone home-screen application.
 */

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zomate Fitness",
    short_name: "Zomate",
    description: "Zomate Fitness booking, coaching and student portal",
    start_url: "/login",
    display: "standalone",
    background_color: "#fdfaf9",
    theme_color: "#e8a598",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/zomate-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
