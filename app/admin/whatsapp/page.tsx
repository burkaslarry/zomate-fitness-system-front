/**
 * [F005][S003]
 * Feature: Balance Sync & Integrations
 * Step: (see Logic)
 * Logic: WhatsApp settings and log viewer for admins.
 */

import { redirect } from "next/navigation";

export default function AdminWhatsappLegacyPage() {
  redirect("/admin/settings/whatsapp");
}
