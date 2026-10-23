import { apiGet, apiPost } from "@/lib/api";

export type PaymentMethod = "cash" | "bank" | "bkash" | "nagad" | "other";
export type FeeStatus = "PAID" | "PARTIAL" | "UNPAID";

export interface FeeTypeDto {
  id: number;
  name: string;
  createdAt: string;
}

export interface ClassFeeDto {
  id: number;
  classId: number;
  feeTypeId: number;
  amount: number;
  feeType: FeeTypeDto;
}

export interface PaymentDto {
  id: number;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  receiptNumber: string | null;
  receivedById: number | null;
  receivedByName: string | null;
  note: string | null;
  status: "active" | "voided";
  voidReason: string | null;
  createdAt: string;
}

export interface StudentFeeDto {
  id: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  classId: number;
  className: string;
  feeTypeId: number;
  feeTypeName: string;
  amountDue: number;
  paid: number;
  remaining: number;
  status: FeeStatus;
  periodMonth: number | null;
  periodYear: number | null;
  note: string | null;
  createdAt: string;
}

export interface TeacherSalaryDto {
  id: number;
  teacherId: number;
  teacherName: string;
  amountDue: number;
  paid: number;
  remaining: number;
  status: FeeStatus;
  periodMonth: number;
  periodYear: number;
  note: string | null;
  createdAt: string;
}

export interface ExpenseDto {
  id: number;
  category: string;
  amount: number;
  date: string;
  note: string | null;
  status: "active" | "voided";
  createdAt: string;
}

export interface FinanceSummaryDto {
  totalIncome: number;
  totalExpense: number;
  salaryExpense: number;
  otherExpense: number;
  profitLoss: number;
  totalDue: number;
  salaryPayable: number;
}

export interface TrendPointDto {
  date: string;
  income: number;
  expense: number;
}

export interface StudentDueDto {
  studentId: number;
  studentName: string;
  studentCode: string;
  classId: number;
  className: string;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
}

function newIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---- fee types + class fees ----

export const fetchFeeTypes = () => apiGet<FeeTypeDto[]>("/finance/fee-types");
export const createFeeType = (name: string) => apiPost<FeeTypeDto>("/finance/fee-types", { name });
export const fetchClassFees = (classId: number) =>
  apiGet<ClassFeeDto[]>(`/finance/class-fees?classId=${classId}`);
export const upsertClassFee = (input: { classId: number; feeTypeId: number; amount: number }) =>
  apiPost<ClassFeeDto>("/finance/class-fees", input);

// ---- student fees + payments ----

export function fetchStudentFees(filters: {
  studentId?: number | undefined;
  classId?: number | undefined;
  feeTypeId?: number | undefined;
  status?: FeeStatus | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && qs.set(k, String(v)));
  return apiGet<{ rows: StudentFeeDto[]; total: number }>(`/finance/student-fees?${qs.toString()}`);
}

export const fetchStudentFee = (id: number) =>
  apiGet<StudentFeeDto & { payments: PaymentDto[] }>(`/finance/student-fees/${id}`);

export const createStudentFee = (input: {
  studentId: number;
  feeTypeId: number;
  amountDue: number;
  periodMonth?: number | undefined;
  periodYear?: number | undefined;
  note?: string | undefined;
}) => apiPost<StudentFeeDto>("/finance/student-fees", input);

export const bulkApplyStudentFee = (input: {
  classId: number;
  feeTypeId: number;
  amount: number;
  periodMonth?: number | undefined;
  periodYear?: number | undefined;
  note?: string | undefined;
}) => apiPost<{ created: number; skipped: number }>("/finance/student-fees/bulk", input);

export const recordStudentPayment = (
  studentFeeId: number,
  input: { amount: number; method: PaymentMethod; paidAt: string; note?: string | undefined },
) =>
  apiPost<PaymentDto>(`/finance/student-fees/${studentFeeId}/payments`, {
    ...input,
    idempotencyKey: newIdempotencyKey(),
  });

export const voidStudentPayment = (paymentId: number, reason: string) =>
  apiPost<PaymentDto>(`/finance/payments/${paymentId}/void`, { reason });

// ---- teacher salary + payments ----

export const fetchTeachers = () =>
  apiGet<Array<{ id: number; name: string; email: string }>>("/finance/teachers");

export function fetchTeacherSalaries(filters: {
  teacherId?: number | undefined;
  periodMonth?: number | undefined;
  periodYear?: number | undefined;
  status?: FeeStatus | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && qs.set(k, String(v)));
  return apiGet<{ rows: TeacherSalaryDto[]; total: number }>(
    `/finance/teacher-salaries?${qs.toString()}`,
  );
}

export const fetchTeacherSalary = (id: number) =>
  apiGet<TeacherSalaryDto & { payments: PaymentDto[] }>(`/finance/teacher-salaries/${id}`);

export const createTeacherSalary = (input: {
  teacherId: number;
  amountDue: number;
  periodMonth: number;
  periodYear: number;
  note?: string | undefined;
}) => apiPost<TeacherSalaryDto>("/finance/teacher-salaries", input);

export const bulkGenerateSalary = (input: {
  teacherIds: number[];
  amountDue: number;
  periodMonth: number;
  periodYear: number;
}) => apiPost<{ created: number; skipped: number }>("/finance/teacher-salaries/bulk", input);

export const recordSalaryPayment = (
  teacherSalaryId: number,
  input: { amount: number; method: PaymentMethod; paidAt: string; note?: string | undefined },
) =>
  apiPost<PaymentDto>(`/finance/teacher-salaries/${teacherSalaryId}/payments`, {
    ...input,
    idempotencyKey: newIdempotencyKey(),
  });

export const voidSalaryPayment = (paymentId: number, reason: string) =>
  apiPost<PaymentDto>(`/finance/salary-payments/${paymentId}/void`, { reason });

// ---- expenses ----

export const fetchExpenses = (filters: {
  from?: string | undefined;
  to?: string | undefined;
  category?: string | undefined;
}) => {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v));
  return apiGet<ExpenseDto[]>(`/finance/expenses?${qs.toString()}`);
};

export const createExpense = (input: {
  category: string;
  amount: number;
  date: string;
  note?: string | undefined;
}) => apiPost<ExpenseDto>("/finance/expenses", input);

export const voidExpense = (id: number, reason: string) =>
  apiPost<ExpenseDto>(`/finance/expenses/${id}/void`, { reason });

// ---- report ----

export function fetchFinanceSummary(filters: {
  from: string;
  to: string;
  classId?: number | undefined;
  studentId?: number | undefined;
  feeTypeId?: number | undefined;
  method?: string | undefined;
}) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && qs.set(k, String(v)));
  return apiGet<FinanceSummaryDto>(`/finance/report/summary?${qs.toString()}`);
}

export const fetchFinanceTrend = (from: string, to: string) =>
  apiGet<TrendPointDto[]>(`/finance/report/trend?from=${from}&to=${to}`);

export const fetchStudentsWithDues = (filters: {
  classId?: number | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}) => {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && qs.set(k, String(v)));
  return apiGet<{ rows: StudentDueDto[]; total: number }>(
    `/finance/report/students-with-dues?${qs.toString()}`,
  );
};
