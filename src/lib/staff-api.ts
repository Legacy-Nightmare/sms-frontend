import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";

export type StaffRole = "admin" | "teacher" | "finance";

export interface StaffDto {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  teacherId: number | null;
  createdAt: string;
}

export function fetchStaff() {
  return apiGet<StaffDto[]>("/users");
}

export function createStaff(input: {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  teacherId?: number | undefined;
}) {
  return apiPost<StaffDto>("/users", input);
}

export function updateStaffRole(id: number, role: StaffRole, teacherId?: number | null | undefined) {
  return apiPut<StaffDto>(`/users/${id}`, { role, teacherId });
}

export function deleteStaff(id: number) {
  return apiDelete<void>(`/users/${id}`);
}
