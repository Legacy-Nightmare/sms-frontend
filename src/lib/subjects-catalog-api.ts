import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";

// The reusable subject catalog ("Bangla", "Mathematics", ...) — distinct
// from exams-api.ts's SubjectDto, which is a single class's own instance of
// one of these (attached by subjectId, with its own editable marks total).
export interface SubjectCatalogDto {
  id: number;
  name: string;
  defaultFullMarks: number | null;
  createdAt: string;
}

export function fetchSubjectCatalog() {
  return apiGet<SubjectCatalogDto[]>("/subject-catalog");
}

export function createSubjectCatalogEntry(input: {
  name: string;
  defaultFullMarks?: number | undefined;
}) {
  return apiPost<SubjectCatalogDto>("/subject-catalog", input);
}

export function updateSubjectCatalogEntry(
  id: number,
  input: { name?: string | undefined; defaultFullMarks?: number | undefined },
) {
  return apiPut<SubjectCatalogDto>(`/subject-catalog/${id}`, input);
}

export function deleteSubjectCatalogEntry(id: number) {
  return apiDelete<void>(`/subject-catalog/${id}`);
}
