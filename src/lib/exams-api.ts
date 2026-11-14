import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";

export type ExamType = "tutorial" | "final";

export interface SubjectDto {
  id: number;
  name: string;
  classId: number;
  subjectId: number;
  fullMarks: number;
}

export interface ExamDto {
  id: number;
  name: string;
  type: ExamType;
  classId: number;
  sectionId: number | null;
  examDate: string | null;
  academicYear: string | null;
  publishedAt: string | null;
  emailedCount: number;
  resultsAnnouncedAt: string | null;
  createdAt: string;
  classEntity: { id: number; level: number | null; name: string };
  section: { id: number; name: string } | null;
}

export interface MarksSheetRowDto {
  studentId: number;
  studentCode: string;
  studentName: string;
  roll: number;
  marksObtained: number | null;
}

export interface MarkValidationError {
  studentId: number;
  subjectId: number;
  message: string;
}

export interface SubjectResultDto {
  subjectId: number;
  subjectName: string;
  marksObtained: number;
  fullMarks: number;
}

export interface StudentExamResultDto {
  studentId: number;
  studentName: string;
  studentCode: string;
  subjects: SubjectResultDto[];
  totalObtained: number;
  totalFullMarks: number;
  percentage: number;
  grade: string;
  gpa: number;
  hasGuardianEmail: boolean;
}

export function fetchExams(filters?: { classId?: number; sectionId?: number }) {
  const qs = new URLSearchParams();
  if (filters?.classId) qs.set("classId", String(filters.classId));
  if (filters?.sectionId) qs.set("sectionId", String(filters.sectionId));
  const query = qs.toString();
  return apiGet<ExamDto[]>(`/exams${query ? `?${query}` : ""}`);
}

export function fetchExam(id: number) {
  return apiGet<ExamDto>(`/exams/${id}`);
}

export function fetchSubjects(classId: number) {
  return apiGet<SubjectDto[]>(`/subjects?classId=${classId}`);
}

export interface ClassSubjectDto {
  id: number;
  name: string;
  fullMarks: number;
  classId: number;
  classLevel: number | null;
  className: string;
  classSortOrder: number;
}

export function fetchAllClassSubjects() {
  return apiGet<ClassSubjectDto[]>("/subjects/all");
}

export function createSubject(input: { subjectId: number; classId: number; fullMarks?: number }) {
  return apiPost<SubjectDto>("/subjects", input);
}

export function updateSubject(subjectId: number, input: { fullMarks: number }) {
  return apiPut<SubjectDto>(`/subjects/${subjectId}`, input);
}

export function deleteSubject(subjectId: number) {
  return apiDelete<void>(`/subjects/${subjectId}`);
}

export function createExam(input: {
  name: string;
  type: ExamType;
  classId: number;
  sectionId?: number | undefined;
  examDate?: string | undefined;
  academicYear?: string | undefined;
}) {
  return apiPost<ExamDto>("/exams", input);
}

export function updateExam(
  examId: number,
  input: {
    name?: string | undefined;
    type?: ExamType | undefined;
    sectionId?: number | null | undefined;
    examDate?: string | undefined;
    academicYear?: string | undefined;
  },
) {
  return apiPut<ExamDto>(`/exams/${examId}`, input);
}

export function fetchMarksSheet(examId: number, subjectId: number, sectionId?: number) {
  const qs = new URLSearchParams({ subjectId: String(subjectId) });
  if (sectionId) qs.set("sectionId", String(sectionId));
  return apiGet<MarksSheetRowDto[]>(`/exams/${examId}/marks-sheet?${qs.toString()}`);
}

export function enterMarks(
  examId: number,
  entries: Array<{ studentId: number; subjectId: number; marksObtained: number }>,
) {
  return apiPost<{ saved: number }>(`/exams/${examId}/marks`, { entries });
}

export function fetchExamResults(examId: number) {
  return apiGet<StudentExamResultDto[]>(`/exams/${examId}/results`);
}

export function fetchStudentResult(examId: number, studentId: number) {
  return apiGet<StudentExamResultDto>(`/exams/${examId}/results/${studentId}`);
}

export function deleteExam(examId: number) {
  return apiDelete<void>(`/exams/${examId}`);
}

export function announceExamResults(examId: number) {
  return apiPost<ExamDto>(`/exams/${examId}/announce-results`);
}

export function retractResultsAnnouncement(examId: number) {
  return apiPost<ExamDto>(`/exams/${examId}/retract-results-announcement`);
}

export interface MissingGuardianEmail {
  studentId: number;
  studentName: string;
  studentCode: string;
}

export function publishExam(examId: number) {
  return apiPost<{ published: number }>(`/exams/${examId}/publish`);
}

export function notifyGuardians(examId: number) {
  return apiPost<{ emailed: number; missingGuardianEmail: MissingGuardianEmail[] }>(
    `/exams/${examId}/notify-guardians`,
  );
}

export function publishAndNotifyGuardians(examId: number) {
  return apiPost<{
    published: number;
    emailed: number;
    missingGuardianEmail: MissingGuardianEmail[];
  }>(`/exams/${examId}/publish-and-notify`);
}

export interface CombinedSubjectResultDto {
  subjectId: number;
  subjectName: string;
  fullMarks: number;
  tutorialMarks: number | null;
  finalMarks: number | null;
  combinedMarks: number;
}

export interface CombinedStudentResultDto {
  studentId: number;
  studentName: string;
  studentCode: string;
  academicYear: string;
  tutorialExam: { id: number; name: string } | null;
  finalExam: { id: number; name: string } | null;
  tutorialWeightPercent: number;
  finalWeightPercent: number;
  subjects: CombinedSubjectResultDto[];
  totalObtained: number;
  totalFullMarks: number;
  percentage: number;
  grade: string;
  gpa: number;
}

export function fetchSemesterResult(classId: number, studentId: number, academicYear: string) {
  return apiGet<CombinedStudentResultDto>(
    `/classes/${classId}/students/${studentId}/semester-result?academicYear=${encodeURIComponent(academicYear)}`,
  );
}
