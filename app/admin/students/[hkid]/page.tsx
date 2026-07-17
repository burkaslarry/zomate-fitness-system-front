"use client";

/**
 * [F001][S001]
 * Feature: Student Onboarding
 * Step: Admin student-id detail — profile, course PINs, trials, category ledger, renewals, activity
 * Logic: Tabs without legacy 帳戶 PIN; installment rows link to receipt upload with期數 context; receipts under 課程記錄.
 */

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import BackendShell from "../../../../components/backend-shell";
import PaymentRecordsTable from "../../../../components/payment-records-table";
import { alertApiError, api, apiAssetUrl } from "../../../../lib/api";
import { getAuthSession } from "../../../../lib/auth";
import type { CategoryEnrollmentRow, CoachDto, MemberFull } from "../../../../types/api";

const PARQ_LABELS: Record<string, string> = {
  q1_heart_condition: "心臟問題（只宜醫生建議下運動）",
  q2_chest_pain_activity: "運動時胸痛",
  q3_chest_pain_rest: "休息時胸痛（過去一個月）",
  q4_dizziness: "運動後暈眩",
  q5_bone_joint_problem: "骨骼／關節問題會因運動惡化",
  q6_blood_pressure_meds: "服用血壓或心臟藥物",
  q7_other_reason: "其他醫生未建議運動的原因"
};

function medicalStatusLabel(status: string | undefined): string {
  if (status === "pending") return "候補（待醫生證明）";
  if (status === "received") return "已收到證明";
  return "毋須";
}

const tabs = ["資料", "課程記錄", "付款紀錄", "活動紀錄"] as const;

type CatRow = { id: number; name: string; is_deleted?: boolean };

/** [F001][S001] Map backend activity_log.type codes to admin-facing 繁中 labels. */
function activityTypeLabel(type: string): string {
  const map: Record<string, string> = {
    member_create: "新會員登記",
    member_profile_update: "更新學生資料",
    member_photo_upload: "上傳學生相片",
    medical_clearance_upload: "上傳 PAR-Q 醫生證明",
    receipt_upload: "上傳收據／付款憑證",
    renewal_create: "報 Course／續會收費",
    trial_class_create: "試堂／加堂登記",
    category_enrollment_upsert: "課程種類入帳（堂數／分期）",
    coach_quota_1: "使用教練試堂名額",
    coach_trial_quota: "使用教練試堂名額",
    checkin: "課堂簽到扣堂",
    trial_purchase: "試堂購買（舊紀錄）"
  };
  return map[type] ?? "其他活動紀錄";
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-HK", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function paymentStatusLabel(status: string, paidAt?: string | null): string {
  if (paidAt) return `已付款 ${fmtDateTime(paidAt)}`;
  const normalized = status.toLowerCase();
  if (normalized === "pending") return "未付款";
  if (normalized === "paid") return "已付款";
  return status;
}

function installmentAmountLabel(amount: number): string {
  return amount > 0 ? `HKD ${amount}` : "未設定金額";
}

function ReceiptThumb({ fileUrl, label }: { fileUrl: string; label: string }) {
  const [failed, setFailed] = useState(false);
  const lower = fileUrl.split("?")[0].toLowerCase();
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(lower);
  if (failed) {
    return <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">檔案預覽失敗，請按連結開啟。</p>;
  }
  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fileUrl}
        alt={label}
        className="mt-2 max-h-40 w-full rounded border border-ink/10 object-contain"
        onError={() => {
          console.warn("[F007][S004] Receipt image failed to load", { fileUrl });
          setFailed(true);
        }}
      />
    );
  }
  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-block text-sm font-medium text-primary underline"
    >
      開啟檔案（PDF／其他）
    </a>
  );
}

export default function AdminStudentDetailPage() {
  const params = useParams<{ hkid: string }>();
  const router = useRouter();
  const [data, setData] = useState<MemberFull | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>("資料");
  const [toast, setToast] = useState("");
  const [categories, setCategories] = useState<CatRow[]>([]);
  const [catId, setCatId] = useState<number | "">("");
  const [lessons, setLessons] = useState(10);
  const [installments, setInstallments] = useState(3);
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [medicalUploading, setMedicalUploading] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [signatureFailed, setSignatureFailed] = useState(false);
  /** When staff picks an unpaid installment, scroll to receipt form and label it (分期第 N 期). */
  const [receiptInstallmentCtx, setReceiptInstallmentCtx] = useState<{
    installmentNo: number;
    categoryName: string;
    installmentPlanId: number;
  } | null>(null);
  const [receiptWaLinks, setReceiptWaLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [coaches, setCoaches] = useState<CoachDto[]>([]);
  const [transferBusy, setTransferBusy] = useState<number | null>(null);
  const [transferCoachPick, setTransferCoachPick] = useState<Record<number, number | "">>({});
  const isAdmin = getAuthSession()?.role === "ADMIN";
  const receiptSectionRef = useRef<HTMLDivElement | null>(null);
  const studentId = decodeURIComponent(params.hkid);

  const reload = useCallback(() => {
    void api.memberFullById(studentId).then((row) => setData(row as MemberFull)).catch(alertApiError);
  }, [studentId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    setPhotoFailed(false);
  }, [data?.profile.photo_url]);

  useEffect(() => {
    setSignatureFailed(false);
  }, [data?.profile.signature_image_url]);

  useEffect(() => {
    void api
      .courseCategories(false)
      .then((rows) => setCategories(rows as CatRow[]))
      .catch(alertApiError);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void api.publicCoaches().then((rows) => setCoaches(Array.isArray(rows) ? (rows as CoachDto[]) : [])).catch(() => {});
  }, [isAdmin]);

  async function onTransferCoach(courseId: number) {
    const nextCoachId = transferCoachPick[courseId];
    if (!nextCoachId) {
      alertApiError(new Error("請選擇新教練"));
      return;
    }
    setTransferBusy(courseId);
    try {
      await api.assignCourseCoach(courseId, Number(nextCoachId));
      setToast("已轉教練（僅 Admin 可操作）");
      reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setTransferBusy(null);
    }
  }

  async function onSaveCategoryEnrollment() {
    if (!data?.profile.id || catId === "") {
      alertApiError(new Error("請選擇課程種類"));
      return;
    }
    setSaving(true);
    try {
      await api.upsertStudentCategoryEnrollment(data.profile.id, {
        course_category_id: Number(catId),
        total_lessons: lessons,
        total_installments: installments
      });
      setToast("已更新課程／堂數");
      reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setSaving(false);
    }
  }

  async function onUploadReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data?.profile.id) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      alertApiError(new Error("請選擇收據圖片或 PDF"));
      return;
    }
    const context =
      receiptInstallmentCtx != null
        ? `分期第${receiptInstallmentCtx.installmentNo}期·${receiptInstallmentCtx.categoryName}`
        : String(form.get("context") ?? "").trim();
    const userNote = String(form.get("note") ?? "").trim();
    setReceiptUploading(true);
    try {
      const sendWhatsapp = form.get("send_whatsapp") === "on";
      const notifyCoach = form.get("notify_coach") === "on";
      const courseEnrollmentRaw = String(form.get("course_enrollment_id") ?? "").trim();
      const res = (await api.uploadMemberReceiptById(data.profile.id, {
        file,
        amount: String(form.get("amount") ?? "").trim(),
        payment_method: String(form.get("payment_method") ?? "").trim(),
        note: userNote,
        context,
        source: "RENEWAL",
        installment_no: receiptInstallmentCtx?.installmentNo,
        installment_plan_id: receiptInstallmentCtx?.installmentPlanId,
        course_enrollment_id: courseEnrollmentRaw ? Number(courseEnrollmentRaw) : undefined,
        send_whatsapp: sendWhatsapp,
        notify_coach: notifyCoach
      })) as {
        whatsapp?: {
          student?: { wa_me_url?: string };
          coach?: { wa_me_url?: string };
        };
      };
      const links: Array<{ label: string; url: string }> = [];
      if (res.whatsapp?.student?.wa_me_url) {
        links.push({ label: "學生 WhatsApp", url: res.whatsapp.student.wa_me_url });
      }
      if (res.whatsapp?.coach?.wa_me_url) {
        links.push({ label: "教練 WhatsApp", url: res.whatsapp.coach.wa_me_url });
      }
      setReceiptWaLinks(links);
      setToast(links.length > 0 ? "已上傳收據並產生 WhatsApp 訊息" : "已上傳收據");
      event.currentTarget.reset();
      setReceiptInstallmentCtx(null);
      reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setReceiptUploading(false);
    }
  }

  async function onUploadMedicalClearance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data?.profile.id) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      alertApiError(new Error("請選擇醫生證明 PDF 或圖片"));
      return;
    }
    setMedicalUploading(true);
    try {
      await api.uploadMedicalClearanceById(data.profile.id, file);
      setToast("已上傳醫生證明");
      event.currentTarget.reset();
      reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setMedicalUploading(false);
    }
  }

  function focusReceiptForInstallment(payload: {
    installmentNo: number;
    categoryName: string;
    installmentPlanId: number;
  }) {
    setReceiptInstallmentCtx(payload);
    setReceiptWaLinks([]);
    setTab("課程記錄");
  }

  async function onDeleteStudent() {
    if (!data?.profile.id) return;
    const name = data.profile.full_name;
    const ok = window.confirm(
      `確定要刪除學生「${name}」？\n\n此為軟刪除：學生會從名單隱藏，相關課程及收費紀錄仍會保留。`
    );
    if (!ok) return;
    setDeleteBusy(true);
    try {
      await api.deleteStudent(data.profile.id);
      router.push("/admin/students");
    } catch (e) {
      alertApiError(e);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data?.profile.id) return;
    const form = new FormData(event.currentTarget);
    setProfileSaving(true);
    try {
      const res = (await api.updateMemberById(data.profile.id, {
        full_name: String(form.get("full_name") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        email: String(form.get("email") ?? "").trim() || null,
        date_of_birth: String(form.get("date_of_birth") ?? "").trim() || null,
        emergency_contact_name: String(form.get("emergency_contact_name") ?? "").trim() || null,
        emergency_contact_phone: String(form.get("emergency_contact_phone") ?? "").trim() || null
      })) as { member?: MemberFull["profile"] };
      if (res.member) {
        setData((current) => (current ? { ...current, profile: res.member as MemberFull["profile"] } : current));
      }
      setToast("已更新學生資料");
      reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setProfileSaving(false);
    }
  }

  useEffect(() => {
    if (tab !== "課程記錄" || !receiptInstallmentCtx) return;
    const t = window.setTimeout(() => {
      receiptSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [tab, receiptInstallmentCtx]);

  const pins = data?.course_checkin_pins ?? [];
  const catEnr = data?.category_enrollments ?? [];
  const packages = data?.packages ?? [];
  const packageLessons = packages.reduce((sum, pkg) => sum + (Number(pkg.lessons) || 0), 0);
  const categoryLessons = catEnr.reduce((sum, row) => sum + (Number(row.total_lessons) || 0), 0);
  const scheduledCourseLessons = pins.reduce(
    (sum, pin) => sum + (Number((pin as { total_lessons?: number }).total_lessons) || 0),
    0
  );
  const ledgerBalance = data?.profile.lesson_balance ?? 0;
  const ledgerMismatch =
    packageLessons > 0 && categoryLessons === 0 && ledgerBalance !== packageLessons;
  const photoSrc = apiAssetUrl(data?.profile.photo_url ?? undefined);
  const signatureSrc = apiAssetUrl(data?.profile.signature_image_url ?? undefined);
  const hasPhoto = Boolean(photoSrc && !photoFailed);
  const receiptContexts = [
    ...pins.map((p) => `Course：${p.course_title}`),
    ...catEnr.map((c) => `Category：${c.category_name}`),
    ...packages.map((p) => `Package：${p.name}`)
  ];

  return (
    <BackendShell title="學生詳情">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-xl border border-ink/15 bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-ink">{data?.profile.full_name ?? `#${studentId}`}</h2>
              <p className="mt-1 text-sm text-ink/65">
                {data?.profile.hkid ?? "—"} · {data?.profile.phone}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data?.profile.is_active && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-800">活躍</span>
              )}
              {/* [F002][S001] Deprecated direct trial grant; all purchases now start at unified payment. */}
              <Link
                href={`/regCourse?type=renewal&student=${encodeURIComponent(String(data?.profile.phone ?? ""))}`}
                className="rounded-lg border border-purple-300 bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700"
              >
                + Purchase / 買堂
              </Link>
              <button
                type="button"
                disabled={!data?.profile.id || deleteBusy}
                onClick={() => void onDeleteStudent()}
                className="rounded-lg border border-rose-300/80 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 shadow-sm hover:bg-rose-100 disabled:opacity-50"
              >
                {deleteBusy ? "刪除中…" : "刪除學生"}
              </button>
            </div>
          </div>
          {toast && <p className="mt-3 rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink/85">{toast}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-lg px-4 py-2 text-sm ${
                tab === item ? "bg-primary/90 text-black" : "border border-ink/15 bg-surface text-ink/85"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <section className="rounded-xl border border-ink/15 bg-surface p-5 text-ink">
          {tab === "資料" && data && (
            <div className="grid gap-5 md:grid-cols-[220px_1fr]">
              <div
                className={`aspect-square overflow-hidden rounded-xl border border-ink/10 bg-canvas${
                  hasPhoto ? "" : " hidden md:block"
                }`}
              >
                {hasPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoSrc}
                    alt={data.profile.full_name}
                    className="h-full w-full object-cover"
                    onError={() => {
                      console.warn("[F007][S004] Student photo failed to load", { photoSrc, profile: data.profile.id });
                      setPhotoFailed(true);
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-ink/45">
                    {photoFailed ? "Photo failed to load" : "No photo"}
                  </div>
                )}
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink/50">Email</dt>
                  <dd>{data.profile.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">出生日期</dt>
                  <dd>{data.profile.date_of_birth ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">曾用電話</dt>
                  <dd>{data.profile.used_mobile_number ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">簽到</dt>
                  <dd className="text-sm text-ink/80">
                    {pins.length > 0
                      ? "使用「課程記錄」內每個課程嘅課堂 PIN 簽到（唔再用帳戶級 PIN）。"
                      : "報讀開課後會獲派課堂 PIN；見「課程記錄」。"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">Emergency</dt>
                  <dd>
                    {data.profile.emergency_contact_name ?? "—"} · {data.profile.emergency_contact_phone ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">剩餘堂數</dt>
                  <dd>{ledgerBalance} 堂</dd>
                </div>
              </dl>
              <form
                key={`profile-${data.profile.id}-${data.profile.phone}`}
                onSubmit={(event) => void onSaveProfile(event)}
                className="space-y-3 rounded-xl border border-ink/10 bg-canvas p-4 md:col-span-2"
              >
                <div>
                  <h3 className="text-sm font-semibold text-ink">編輯學生資料</h3>
                  <p className="mt-1 text-xs text-ink/55">
                    改電話時，舊號會保存到曾用電話，用作追蹤。
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-ink/55">
                    姓名
                    <input name="full_name" required defaultValue={data.profile.full_name} className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink" />
                  </label>
                  <label className="block text-xs text-ink/55">
                    手機號碼
                    <input name="phone" required inputMode="numeric" defaultValue={data.profile.phone} className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink" />
                  </label>
                  <label className="block text-xs text-ink/55">
                    出生日期
                    <input name="date_of_birth" type="date" defaultValue={data.profile.date_of_birth ?? ""} className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink" />
                  </label>
                  <label className="block text-xs text-ink/55">
                    Email
                    <input name="email" type="email" defaultValue={data.profile.email ?? ""} className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink" />
                  </label>
                  <label className="block text-xs text-ink/55">
                    緊急聯絡人
                    <input name="emergency_contact_name" defaultValue={data.profile.emergency_contact_name ?? ""} className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink" />
                  </label>
                  <label className="block text-xs text-ink/55">
                    緊急聯絡電話
                    <input name="emergency_contact_phone" inputMode="numeric" defaultValue={data.profile.emergency_contact_phone ?? ""} className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink" />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="rounded-lg bg-primary/90 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
                >
                  {profileSaving ? "儲存中…" : "儲存學生資料"}
                </button>
              </form>
              <div className="space-y-3 rounded-xl border border-ink/10 bg-canvas p-4 md:col-span-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">簽名圖</h3>
                  <p className="mt-1 text-xs text-ink/55">入職／登記流程 Step 3 數碼簽名（canvas PNG）。</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-ink/10 bg-white">
                  {signatureSrc && !signatureFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={signatureSrc}
                      alt={`${data.profile.full_name} 簽名`}
                      className="mx-auto max-h-48 w-full object-contain p-4"
                      onError={() => {
                        console.warn("[F001][S004] Signature image failed to load", {
                          signatureSrc,
                          profile: data.profile.id
                        });
                        setSignatureFailed(true);
                      }}
                    />
                  ) : (
                    <div className="flex min-h-[8rem] items-center justify-center px-4 py-8 text-center text-sm text-ink/45">
                      {signatureFailed
                        ? "簽名圖載入失敗（可能 Render 重啟後檔案遺失；可請學員重新簽名）"
                        : "尚未上傳簽名"}
                    </div>
                  )}
                </div>
                {signatureSrc && !signatureFailed ? (
                  <a
                    href={signatureSrc}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-medium text-primary underline"
                  >
                    開啟原圖
                  </a>
                ) : null}
              </div>
              <div className="space-y-3 rounded-xl border border-ink/10 bg-canvas p-4 md:col-span-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">PAR-Q ／ 醫生證明</h3>
                  <p className="mt-1 text-xs text-ink/55">
                    登記問卷與醫生證明狀態。PAR-Q 有任何「是」而未有檔案時為<strong className="text-amber-900">候補</strong>。
                  </p>
                </div>
                <p className="text-sm text-ink">
                  狀態：
                  <span
                    className={
                      (data.health?.medical_clearance_status ?? data.profile.medical_clearance_status) === "pending"
                        ? "ml-1 font-medium text-amber-800"
                        : "ml-1 font-medium text-ink"
                    }
                  >
                    {medicalStatusLabel(data.health?.medical_clearance_status ?? data.profile.medical_clearance_status)}
                  </span>
                </p>
                {data.health?.parq && Object.keys(data.health.parq).length > 0 ? (
                  <ul className="space-y-1 text-sm text-ink/85">
                    {Object.entries(data.health.parq).map(([key, yes]) => (
                      <li key={key} className="flex gap-2">
                        <span className={yes ? "font-medium text-amber-900" : "text-ink/55"}>{yes ? "是" : "否"}</span>
                        <span>{PARQ_LABELS[key] ?? key}</span>
                      </li>
                    ))}
                  </ul>
                ) : data.profile.parq_any_yes ? (
                  <p className="text-sm text-ink/70">PAR-Q 有「是」答案（詳細問卷未載入）。</p>
                ) : (
                  <p className="text-sm text-ink/55">PAR-Q 全部「否」— 毋須醫生證明。</p>
                )}
                {data.health?.medical_clearance_url ? (
                  <ReceiptThumb
                    fileUrl={apiAssetUrl(data.health.medical_clearance_url) ?? data.health.medical_clearance_url}
                    label="醫生證明"
                  />
                ) : null}
                {(data.health?.medical_clearance_status ?? data.profile.medical_clearance_status) === "pending" ||
                ((data.health?.parq_any_yes ?? data.profile.parq_any_yes) &&
                  (data.health?.medical_clearance_status ?? data.profile.medical_clearance_status) !== "received") ? (
                  <form onSubmit={(event) => void onUploadMedicalClearance(event)} className="space-y-3 border-t border-ink/10 pt-3">
                    <label className="block text-xs text-ink/55">
                      上傳醫生證明（PDF／圖片，≤3MB）
                      <input
                        name="file"
                        type="file"
                        accept="image/*,.pdf,application/pdf"
                        required
                        className="mt-1 block w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={medicalUploading}
                      className="rounded-lg bg-primary/90 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
                    >
                      {medicalUploading ? "上傳中…" : "上傳並標記為已收到"}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          )}
          {tab === "課程記錄" && data && (
            <div className="space-y-8">
              <div className="rounded-xl border border-ink/10 bg-canvas p-4">
                <h3 className="text-sm font-semibold text-ink">堂數總覽</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-ink/10 bg-surface p-3">
                    <p className="text-xs text-ink/55">已付款套餐</p>
                    <p className="mt-1 text-2xl font-semibold text-ink">{packageLessons}</p>
                  </div>
                  <div className="rounded-lg border border-ink/10 bg-surface p-3">
                    <p className="text-xs text-ink/55">已開課程（時間表）</p>
                    <p className="mt-1 text-2xl font-semibold text-ink">
                      {pins.length === 0 ? "—" : scheduledCourseLessons}
                    </p>
                  </div>
                  <div className="rounded-lg border border-ink/10 bg-surface p-3">
                    <p className="text-xs text-ink/55">可扣堂餘額</p>
                    <p className="mt-1 text-2xl font-semibold text-primary">{ledgerBalance}</p>
                  </div>
                </div>
                {categoryLessons > 0 ? (
                  <p className="mt-2 text-xs text-ink/55">種類報讀帳面：{categoryLessons} 堂（與套餐分開計）</p>
                ) : null}
                {ledgerMismatch ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    餘額（{ledgerBalance}）同已付款套餐（{packageLessons}）唔一致 — 可能重複入帳。請 Admin 用 ledger 修正。
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-ink/55">
                    報課流程：先記錄付款，再開課派 PIN；可扣堂餘額應等於已付款套餐（扣堂後遞減）。
                  </p>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-ink">Package／續會紀錄</h3>
                {packages.length === 0 ? (
                  <p className="text-sm text-ink/55">暫無續會／套餐登記紀錄。</p>
                ) : (
                  <ul className="space-y-3">
                    {packages.map((pkg) => (
                      <li
                        key={pkg.id}
                        className="rounded-xl border border-ink/10 bg-canvas px-4 py-3 shadow-sm ring-1 ring-ink/[0.04]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-ink">{pkg.name}</h4>
                            <p className="mt-1 text-xs text-ink/60">
                              堂數 {pkg.lessons} · 教練 {pkg.coach ?? "—"} · {pkg.payment_method ?? "—"}
                            </p>
                            <p className="mt-1 text-xs text-ink/50">
                              {pkg.renewal_date ? `續會日 ${pkg.renewal_date} · ` : ""}
                              建立 {fmtDateTime(pkg.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold tabular-nums text-ink">
                              {pkg.amount != null ? `HKD ${pkg.amount}` : "—"}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">已開課程（有時間表）</h3>
                {pins.length === 0 ? (
                  <p className="text-sm text-ink/55">
                    尚未經「Course 套餐開課」加入任何課程。種類入帳唔會自動出現喺度。
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {pins.map((p) => (
                      <li
                        key={`${p.course_id}-${p.checkin_pin}`}
                        className="rounded-lg border border-ink/10 bg-canvas px-4 py-3 text-sm"
                      >
                        <div className="font-medium text-ink">{p.course_title}</div>
                        <div className="mt-1 text-xs text-ink/65">
                          {p.branch_name} · 教練 {p.coach_name ?? "—"}
                        </div>
                        <div className="mt-1 text-xs text-ink/55">
                          首課（基準）{p.scheduled_start ? fmtDateTime(p.scheduled_start) : "—"}
                          {p.series_end_date ? ` · 預計最後一堂 ${p.series_end_date}` : ""}
                        </div>
                        <div className="mt-2 font-mono text-base font-semibold tracking-wide text-ink">
                          課堂 PIN：{p.checkin_pin}
                        </div>
                        {isAdmin ? (
                          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-ink/10 pt-3">
                            <label className="text-xs text-ink/55">
                              轉教練（Admin）
                              <select
                                value={transferCoachPick[p.course_id] ?? p.coach_id ?? ""}
                                onChange={(e) =>
                                  setTransferCoachPick((prev) => ({
                                    ...prev,
                                    [p.course_id]: e.target.value ? Number(e.target.value) : ""
                                  }))
                                }
                                className="mt-1 block rounded-lg border border-ink/15 bg-surface px-2 py-1.5 text-sm"
                              >
                                <option value="">選擇教練</option>
                                {coaches.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.full_name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              disabled={transferBusy === p.course_id}
                              onClick={() => void onTransferCoach(p.course_id)}
                              className="rounded-lg bg-primary/90 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                            >
                              {transferBusy === p.course_id ? "…" : "確認轉教練"}
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-ink">試堂／加堂紀錄</h3>
                {(data.trial_classes ?? []).length === 0 ? (
                  <p className="text-sm text-ink/55">暫無試堂／加堂紀錄。</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {(data.trial_classes ?? []).map((t) => (
                      <li key={t.id} className="rounded-lg border border-ink/10 bg-canvas p-3 text-sm">
                        <div className="font-medium text-ink">
                          {t.type === "TRIAL" ? "試堂" : "加堂"}
                          {t.trial_kind_label_zh ? ` · ${t.trial_kind_label_zh}` : ""}
                        </div>
                        <div className="mt-1 text-xs text-ink/65">
                          日期 {t.class_date} · 教練 {t.coach_name ?? (t.coach_id ? `#${t.coach_id}` : "—")} ·{" "}
                          分店 {t.branch_name ?? (t.branch_id ? `#${t.branch_id}` : "—")}
                        </div>
                        {t.note ? <p className="mt-2 text-xs text-ink/60">{t.note}</p> : null}
                        <p className="mt-1 text-[11px] text-ink/45">建立 {fmtDateTime(t.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-primary/35 bg-primary/5 p-4">
                <h3 className="mb-3 text-sm font-semibold text-ink">從課程種類入帳堂數（Admin）</h3>
                <p className="mb-3 text-xs text-ink/60">
                  選擇種類及總堂數；如該種類已存在會調整堂數差額。會建立分期計劃（預設 3 期）。
                </p>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <label className="block text-xs text-ink/55">
                    課程種類
                    <select
                      className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-2 py-2 text-sm text-ink"
                      value={catId === "" ? "" : String(catId)}
                      onChange={(e) => setCatId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">—</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-ink/55">
                    總堂數
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-2 py-2 text-sm"
                      value={lessons}
                      onChange={(e) => setLessons(Number(e.target.value) || 1)}
                    />
                  </label>
                  <label className="block text-xs text-ink/55">
                    分期數（1–5）
                    <input
                      type="number"
                      min={1}
                      max={5}
                      className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-2 py-2 text-sm"
                      value={installments}
                      onChange={(e) => setInstallments(Math.min(5, Math.max(1, Number(e.target.value) || 3)))}
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void onSaveCategoryEnrollment()}
                      className="w-full rounded-lg bg-primary/90 py-2 text-sm font-medium text-black disabled:opacity-50"
                    >
                      {saving ? "…" : "儲存"}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-ink">種類報讀紀錄（帳面）· 分期</h3>
                {catEnr.length === 0 ? (
                  <p className="text-sm text-ink/55">暫無</p>
                ) : (
                  <ul className="space-y-4">
                    {catEnr.map((c) => (
                      <CategoryEnrollmentCard key={c.id} row={c} onReceiptForInstallment={focusReceiptForInstallment} />
                    ))}
                  </ul>
                )}
              </div>

              <div ref={receiptSectionRef}>
                <h3 className="mb-3 text-sm font-semibold text-ink">
                  收據／上傳憑證
                  {receiptInstallmentCtx
                    ? ` — 第 ${receiptInstallmentCtx.installmentNo} 期（${receiptInstallmentCtx.categoryName}）`
                    : ""}
                </h3>
                {receiptInstallmentCtx ? (
                  <p className="mb-3 text-xs text-ink/55">
                    上傳後系統會於備註自動加上「分期第{receiptInstallmentCtx.installmentNo}期」標籤，方便對照。
                    <button
                      type="button"
                      className="ml-2 underline decoration-ink/30"
                      onClick={() => setReceiptInstallmentCtx(null)}
                    >
                      清除分期對應
                    </button>
                  </p>
                ) : null}
                <form
                  onSubmit={(event) => void onUploadReceipt(event)}
                  className="mb-4 grid gap-3 rounded-xl border border-ink/10 bg-canvas p-4 text-sm md:grid-cols-2"
                >
                  <label className="block text-xs text-ink/55 md:col-span-2">
                    上傳收據（圖片／PDF）
                    <input
                      name="file"
                      type="file"
                      accept="image/*,.pdf,application/pdf"
                      required
                      className="mt-1 block w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  <label className="block text-xs text-ink/55">
                    金額（選填）
                    <input
                      name="amount"
                      inputMode="decimal"
                      placeholder="例如 7932"
                      className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  <label className="block text-xs text-ink/55">
                    付款方式（選填）
                    <input
                      name="payment_method"
                      placeholder="cash / fps / card"
                      className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  <label className="block text-xs text-ink/55 md:col-span-2">
                    對應 Course（分期 PIN 解鎖，選填）
                    <select
                      name="course_enrollment_id"
                      className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink"
                    >
                      <option value="">不指定（僅 category 分期）</option>
                      {pins.map((p) => (
                        <option key={p.course_id} value={String(p.course_id)}>
                          {p.course_title} · PIN {p.checkin_pin}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-ink/70 md:col-span-2">
                    <input type="checkbox" name="send_whatsapp" defaultChecked className="rounded border-ink/20" />
                    上傳後產生 WhatsApp 提醒（學生）
                  </label>
                  <label className="flex items-center gap-2 text-xs text-ink/70 md:col-span-2">
                    <input type="checkbox" name="notify_coach" defaultChecked className="rounded border-ink/20" />
                    同時通知教練
                  </label>
                  <label className="block text-xs text-ink/55 md:col-span-2">
                    備註（選填）
                    <input
                      name="note"
                      placeholder="例如：補回第一期收據"
                      className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  <label className="block text-xs text-ink/55 md:col-span-2">
                    對應 Course / Category 備註（選填）
                    <select
                      name="context"
                      disabled={receiptInstallmentCtx != null}
                      className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink disabled:opacity-60"
                    >
                      <option value="">不指定</option>
                      {receiptContexts.map((ctx) => (
                        <option key={ctx} value={ctx}>
                          {ctx}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={receiptUploading}
                    className="rounded-lg bg-primary/90 px-4 py-2 text-sm font-medium text-black disabled:opacity-50 md:justify-self-start"
                  >
                    {receiptUploading ? "上傳中…" : "上傳收據"}
                  </button>
                </form>
                {receiptWaLinks.length > 0 ? (
                  <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900">
                    <p className="font-medium">WhatsApp 快速連結</p>
                    <ul className="mt-2 space-y-1">
                      {receiptWaLinks.map((link) => (
                        <li key={link.label}>
                          <a href={link.url} target="_blank" rel="noreferrer" className="underline">
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {(data.receipts ?? []).length === 0 ? (
                  <p className="text-sm text-ink/55">暫無收據檔案。</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {(data.receipts ?? []).map((r) => {
                      const abs = apiAssetUrl(r.file_url ?? undefined) ?? "#";
                      return (
                        <li key={r.id} className="rounded-lg border border-ink/10 bg-canvas p-3 text-sm">
                          <div className="font-medium text-ink">
                            {r.source} · {r.payment_method ?? "付款方式未填"}
                          </div>
                          <div className="mt-1 text-xs text-ink/55">
                            {r.amount != null ? `HKD ${r.amount}` : "金額 —"} · {fmtDateTime(r.created_at)}
                          </div>
                          {r.note ? <p className="mt-1 text-xs text-ink/60">{r.note}</p> : null}
                          <ReceiptThumb fileUrl={abs} label={`receipt-${r.id}`} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
          {tab === "付款紀錄" && data && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">付款紀錄 Payment Record</h3>
                <p className="mt-1 text-xs text-ink/55">續會／報 Course、獨立收據、種類分期 — 含缺收據狀態。</p>
              </div>
              <PaymentRecordsTable rows={data.payment_records ?? []} />
            </div>
          )}
          {tab === "活動紀錄" && data && (
            <div className="space-y-2">
              {(data.activity_log ?? []).length === 0 ? (
                <p className="text-sm text-ink/55">暫無記錄</p>
              ) : (
                <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-canvas">
                  {(data.activity_log ?? []).map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <span className="font-medium text-ink">{activityTypeLabel(a.type)}</span>
                      <time className="text-xs text-ink/55">{fmtDateTime(a.created_at)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </BackendShell>
  );
}

function CategoryEnrollmentCard({
  row,
  onReceiptForInstallment
}: {
  row: CategoryEnrollmentRow;
  onReceiptForInstallment: (payload: {
    installmentNo: number;
    categoryName: string;
    installmentPlanId: number;
  }) => void;
}) {
  const plans = row.installment_plans ?? [];
  const categoryName = row.category_name;
  return (
    <li className="rounded-xl border border-ink/10 bg-canvas p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-ink">{row.category_name}</span>
        <span className="text-xs text-ink/50">{row.status}</span>
      </div>
      <p className="mt-1 text-xs text-ink/60">
        總堂 {row.total_lessons} · 開始 {row.started_at}
      </p>
      {plans.length === 0 ? (
        <p className="mt-2 text-xs text-ink/50">未有分期計劃</p>
      ) : (
        <ul className="mt-3 space-y-3 border-t border-ink/10 pt-3">
          {plans.map((pl) => (
            <li key={pl.id} className="text-xs">
              <div className="font-medium text-ink/80">
                分期方案 · 共 {pl.total_installments} 期 · {pl.status}
              </div>
              <ul className="mt-2 space-y-1 pl-2">
                {pl.payments.map((pay) => (
                  <li key={pay.id} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-ink/70">
                    <span>
                      第 {pay.installment_no} 期 · {installmentAmountLabel(pay.amount)} · 到期 {pay.due_date}
                    </span>
                    <span className={pay.paid_at ? "text-emerald-700" : "text-amber-800"}>
                      {pay.paid_at ? (
                        paymentStatusLabel(pay.status, pay.paid_at)
                      ) : (
                        <>
                          {paymentStatusLabel(pay.status, pay.paid_at)}{" "}
                          <button
                            type="button"
                            className="text-primary underline decoration-primary/40 underline-offset-2 hover:opacity-90"
                            onClick={() =>
                              onReceiptForInstallment({
                                installmentNo: pay.installment_no,
                                categoryName,
                                installmentPlanId: pl.id
                              })
                            }
                          >
                            （收據／上傳憑證）
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
