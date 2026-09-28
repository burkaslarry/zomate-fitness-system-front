"use client";

/**
 * [F006][S005]
 * Feature: Mobile PWA shell
 * Step: Register the offline-safe service worker after the page loads.
 * Logic: Cache only the app shell; authenticated API responses are never cached.
 */

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => void navigator.serviceWorker.register("/sw.js");
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
