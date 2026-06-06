import { redirect } from "next/navigation";

/** [F002][S001] Course categories merged into 課堂和分店管理. */
export default function AdminCourseCategoriesRedirectPage() {
  redirect("/admin/branches");
}
