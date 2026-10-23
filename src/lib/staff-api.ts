import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";

export type StaffRole = "admin" | "teacher" | "finance";

export interface StaffDto {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
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
}) {
  return apiPost<StaffDto>("/users", input);
}

export function updateStaffRole(id: number, role: StaffRole) {
  return apiPut<StaffDto>(`/users/${id}`, { role });
}

export function deleteStaff(id: number) {
  return apiDelete<void>(`/users/${id}`);
}
