import { apiGet } from "@/lib/api";

export interface DashboardSummaryDto {
  totalStudents: number;
  totalClasses: number;
  totalSections: number;
  presentToday: number;
  unpublishedExams: Array<{ id: number; name: string; className: string; classId: number }>;
}

export function fetchDashboardSummary() {
  return apiGet<DashboardSummaryDto>("/dashboard/summary");
}

export interface AttendanceTrendPointDto {
  date: string;
  present: number;
  absent: number;
}

export function fetchAttendanceTrend() {
  return apiGet<AttendanceTrendPointDto[]>("/dashboard/attendance-trend");
}
