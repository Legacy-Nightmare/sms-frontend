import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";

export interface SectionDto {
  id: number;
  name: string;
  classId: number;
  studentCount?: number;
}

export interface ClassDto {
  id: number;
  level: number;
  name: string;
  tutorialWeightPercent: number;
  finalWeightPercent: number;
  sections: SectionDto[];
  studentCount: number;
}

export function fetchClasses() {
  return apiGet<ClassDto[]>("/classes");
}

export function fetchSections(classId: number) {
  return apiGet<SectionDto[]>(`/sections?classId=${classId}`);
}

export function createClass(input: { level: number; name: string }) {
  return apiPost<ClassDto>("/classes", input);
}

export function createSection(input: { name: string; classId: number }) {
  return apiPost<SectionDto>("/sections", input);
}

export function updateResultWeights(
  classId: number,
  input: { tutorialWeightPercent: number; finalWeightPercent: number },
) {
  return apiPut<ClassDto>(`/classes/${classId}/result-weights`, input);
}

export function updateSection(sectionId: number, input: { name: string }) {
  return apiPut<SectionDto>(`/sections/${sectionId}`, input);
}

export function deleteSection(sectionId: number) {
  return apiDelete<void>(`/sections/${sectionId}`);
}
