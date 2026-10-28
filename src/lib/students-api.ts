
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from "@/lib/api";

const API_BASE_URL =
  import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8082";

export function studentPhotoUrl(photoUrl: string | null): string | null {
  if (!photoUrl) {
    return null;
  }

  const path = photoUrl.trim();

  if (!path) {
    return null;
  }

  // Already a complete HTTP/HTTPS URL: return unchanged.
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  // Public RustFS files are served directly through Nginx.
  if (path.startsWith("/sms-uploads/")) {
    return path;
  }

  // Handle RustFS paths without a leading slash.
  if (path.startsWith("sms-uploads/")) {
    return `/${path}`;
  }

  // Other backend-relative file URLs.
  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  const relativePath = path.replace(/^\/+/, "");

  return `${baseUrl}/${relativePath}`;
}

export type GuardianRelation = "father" | "mother" | "other";

export interface GuardianDto {
  id: number;
  name: string;
  relation: GuardianRelation;
  phone: string | null;
  email: string | null;
  studentId: number;
}

export interface StudentDto {
  id: number;
  name: string;
  code: string;
  biometricId: number;
  roll: number;
  classId: number;
  sectionId: number;
  dateOfBirth: string | null;
  photoUrl: string | null;
  isActive: boolean;
  guardians: GuardianDto[];
  classEntity: { id: number; level: number; name: string };
  section: { id: number; name: string; classId: number };
  createdAt: string;
}

export interface CreateStudentInput {
  name: string;
  classId: number;
  sectionId: number;
  roll: number;
  dateOfBirth?: string | undefined;
  guardians?:
    | Array<{
        name: string;
        relation: GuardianRelation;
        phone?: string | undefined;
        email?: string | undefined;
      }>
    | undefined;
}

export function fetchStudents(filters?: {
  classId?: number;
  sectionId?: number;
}) {
  const params = new URLSearchParams();

  if (filters?.classId) {
    params.set("classId", String(filters.classId));
  }

  if (filters?.sectionId) {
    params.set("sectionId", String(filters.sectionId));
  }

  const qs = params.toString();

  return apiGet<StudentDto[]>(`/students${qs ? `?${qs}` : ""}`);
}

export function createStudent(input: CreateStudentInput) {
  return apiPost<StudentDto>("/students", input);
}

export interface UpdateStudentInput {
  name?: string | undefined;
  classId?: number | undefined;
  sectionId?: number | undefined;
  roll?: number | undefined;
  dateOfBirth?: string | undefined;
  isActive?: boolean | undefined;
  guardian?:
    | {
        name?: string | undefined;
        relation?: GuardianRelation | undefined;
        phone?: string | undefined;
        email?: string | undefined;
      }
    | undefined;
}

export function updateStudent(
  studentId: number,
  input: UpdateStudentInput,
) {
  return apiPut<StudentDto>(`/students/${studentId}`, input);
}

export function deleteStudent(studentId: number) {
  return apiDelete<void>(`/students/${studentId}`);
}

export function uploadStudentPhoto(studentId: number, file: File) {
  const formData = new FormData();
  formData.append("photo", file);

  return apiUpload<StudentDto>(`/students/${studentId}/photo`, formData);
}
