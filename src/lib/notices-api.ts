import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";

export interface NoticeDto {
  id: number;
  title: string;
  body: string;
  classId: number | null;
  classEntity: { id: number; level: number; name: string } | null;
  createdById: number | null;
  publishedAt: string | null;
  publishedToWebsiteAt: string | null;
  createdAt: string;
}

export function fetchNotices() {
  return apiGet<NoticeDto[]>("/notices");
}

export function createNotice(input: { title: string; body: string; classId?: number | undefined }) {
  return apiPost<NoticeDto>("/notices", input);
}

export function updateNotice(
  id: number,
  input: { title: string; body: string; classId?: number | undefined },
) {
  return apiPut<NoticeDto>(`/notices/${id}`, input);
}

export function deleteNotice(id: number) {
  return apiDelete<void>(`/notices/${id}`);
}

export function publishNotice(id: number) {
  return apiPost<{ emailed: number }>(`/notices/${id}/publish`);
}

export function publishNoticeToWebsite(id: number) {
  return apiPost<NoticeDto>(`/notices/${id}/publish-to-website`);
}

export function unpublishNoticeFromWebsite(id: number) {
  return apiPost<NoticeDto>(`/notices/${id}/unpublish-from-website`);
}
