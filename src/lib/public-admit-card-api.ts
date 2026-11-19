import { publicGet, publicPost } from "@/lib/public-api";

export interface PublicClassDto {
  id: number;
  name: string;
  sections: { id: number; name: string }[];
}

export interface PublicAdmitCardExamDto {
  id: number;
  name: string;
  academicYear: string | null;
}

export interface PublicAdmitCardResultDto {
  eligible: boolean;
  reason?: "NOT_FOUND" | "NOT_BILLED" | "UNPAID" | "NO_ADMIT_CARD";
  message?: string;
  admitCard?: {
    studentName: string;
    roll: number;
    className: string;
    sectionName: string;
    examName: string | null;
    photoDataUrl: string | null;
  };
}

export function fetchPublicAdmitCardClasses() {
  return publicGet<PublicClassDto[]>("/admit-card/classes");
}

export function fetchPublicAdmitCardExams(input: {
  classId: number;
  sectionId: number;
  roll: number;
}) {
  return publicPost<{ exams: PublicAdmitCardExamDto[] }>("/admit-card/exams", input);
}

export function requestPublicAdmitCardDownload(input: {
  classId: number;
  sectionId: number;
  roll: number;
  examId: number;
  recaptchaToken: string;
  dateOfBirth?: string | undefined;
}) {
  return publicPost<PublicAdmitCardResultDto>("/admit-card/download", input);
}
