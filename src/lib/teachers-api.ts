import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from "@/lib/api";

const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8082";

// Same passthrough rule as studentPhotoUrl: photos come back as full RustFS
// URLs already; /sms-uploads/ paths are served directly through Nginx from
// the frontend's own origin, and only a legacy local-disk path needs the
// API origin prepended.
export function teacherPhotoUrl(photoUrl: string | null): string | null {
  if (!photoUrl) {
    return null;
  }

  const path = photoUrl.trim();

  if (!path) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith("/sms-uploads/")) {
    return path;
  }

  if (path.startsWith("sms-uploads/")) {
    return `/${path}`;
  }

  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  const relativePath = path.replace(/^\/+/, "");

  return `${baseUrl}/${relativePath}`;
}

export interface TeacherAssignment {
  id: number;
  classSubjectId: number;
  classId: number;
  classLevel: number | null;
  className: string;
  classSortOrder: number;
  subjectName: string;
}

export interface TeacherDto {
  id: number;
  name: string;
  photoUrl: string | null;
  salary: number | null;
  nid: string | null;
  dateOfBirth: string | null;
  joiningDate: string | null;
  isActive: boolean;
  createdAt: string;
  assignments: TeacherAssignment[];
}

export interface TeacherInput {
  name: string;
  salary?: number | undefined;
  nid?: string | undefined;
  dateOfBirth?: string | undefined;
  joiningDate?: string | undefined;
  isActive?: boolean | undefined;
}

export function fetchTeachers() {
  return apiGet<TeacherDto[]>("/teachers");
}

export function createTeacher(input: TeacherInput) {
  return apiPost<TeacherDto>("/teachers", input);
}

export function updateTeacher(id: number, input: Partial<TeacherInput>) {
  return apiPut<TeacherDto>(`/teachers/${id}`, input);
}

export function deleteTeacher(id: number) {
  return apiDelete<void>(`/teachers/${id}`);
}

export function uploadTeacherPhoto(id: number, file: File) {
  const formData = new FormData();
  formData.append("photo", file);
  return apiUpload<TeacherDto>(`/teachers/${id}/photo`, formData);
}

export function setTeacherAssignments(id: number, classSubjectIds: number[]) {
  return apiPut<TeacherDto>(`/teachers/${id}/assignments`, { classSubjectIds });
}
