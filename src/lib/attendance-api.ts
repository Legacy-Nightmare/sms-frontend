import { apiGet } from "@/lib/api";

export interface RecentPunchDto {
  id: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  className: string;
  sectionName: string;
  deviceSn: string;
  punchTime: string;
}

export interface ClassAttendanceRowDto {
  studentId: number;
  studentCode: string;
  studentName: string;
  photoUrl: string | null;
  punchTime: string | null;
  deviceSn: string | null;
  status: "present" | "absent";
}

export function fetchRecentAttendance(limit = 10) {
  return apiGet<RecentPunchDto[]>(`/attendance/recent?limit=${limit}`);
}

export function fetchClassAttendance(classId: number, sectionId: number | undefined, date: string) {
  const params = new URLSearchParams({ classId: String(classId), date });
  if (sectionId) params.set("sectionId", String(sectionId));
  return apiGet<ClassAttendanceRowDto[]>(`/attendance?${params.toString()}`);
}
