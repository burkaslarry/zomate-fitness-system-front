import { redirect } from "next/navigation";

/** 財務總覽已自選單移除；舊連結導向銷售與分期。 */
export default function AdminFinanceRedirectPage() {
  redirect("/admin/finance/sales");
}
