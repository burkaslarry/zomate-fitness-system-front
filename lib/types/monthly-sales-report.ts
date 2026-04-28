/**
 * Course sale line item for the monthly sales report.
 * Field names align with a typical Kotlin/Jackson JSON payload (camelCase).
 */
export interface CourseSaleRow {
  date: string;
  clientName: string;
  courseType: string;
  amount: number;
  coachName: string;
  paymentStatus: string;
  /** Mock / Kotlin: installment lifecycle */
  installmentStatus?: "NONE" | "ACTIVE" | "COMPLETE" | "DEFAULT";
}

export const SALES_REPORT_COLUMN_IDS = [
  "date",
  "clientName",
  "courseType",
  "amount",
  "coachName",
  "paymentStatus",
  "installmentStatus"
] as const;

export type SalesReportColumnId = (typeof SALES_REPORT_COLUMN_IDS)[number];

export interface MonthlySalesReportQuery {
  /** Comma-separated sorts: `date:desc,amount:asc` */
  sort?: string;
  /** Comma-separated visible column ids, e.g. `date,clientName,amount` */
  columns?: string;
}

export interface MonthlySalesReportApiResponse {
  rows?: CourseSaleRow[];
  data?: CourseSaleRow[];
  content?: CourseSaleRow[];
  /** Some Spring controllers return the array at the root */
  items?: CourseSaleRow[];
}
