/**
 * [F006][S001]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: Landing route for the Next.js app.
 */

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");
}
