import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from "@/lib/api";
import type {
  GalleryPhotoDto,
  InstitutionDto,
  SchoolProfileDto,
  SiteDocumentDto,
} from "@/lib/public-site-api";

export type {
  GalleryPhotoDto,
  InstitutionDto,
  SchoolProfileDto,
  SiteDocumentDto,
} from "@/lib/public-site-api";

export function fetchSchoolProfile() {
  return apiGet<SchoolProfileDto>("/website/profile");
}

export interface UpdateSchoolProfileInput {
  schoolName?: string;
  tagline?: string;
  aboutText?: string;
  address?: string;
  phone?: string;
  email?: string;
  mapUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  xUrl?: string;
}

export function updateSchoolProfile(input: UpdateSchoolProfileInput) {
  return apiPut<SchoolProfileDto>("/website/profile", input);
}

export function uploadSchoolLogo(file: File) {
  const formData = new FormData();
  formData.append("logo", file);
  return apiUpload<SchoolProfileDto>("/website/profile/logo", formData);
}

export function uploadHeroImage(file: File) {
  const formData = new FormData();
  formData.append("image", file);
  return apiUpload<SchoolProfileDto>("/website/profile/hero-image", formData);
}

export function fetchInstitutions() {
  return apiGet<InstitutionDto[]>("/website/institutions");
}

export interface InstitutionInput {
  name: string;
  caption?: string;
  tone?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export function createInstitution(input: InstitutionInput) {
  return apiPost<InstitutionDto>("/website/institutions", input);
}

export function updateInstitution(id: number, input: Partial<InstitutionInput>) {
  return apiPut<InstitutionDto>(`/website/institutions/${id}`, input);
}

export function deleteInstitution(id: number) {
  return apiDelete<void>(`/website/institutions/${id}`);
}

export function fetchGalleryPhotos() {
  return apiGet<GalleryPhotoDto[]>("/website/gallery");
}

export function uploadGalleryPhoto(file: File, caption?: string) {
  const formData = new FormData();
  formData.append("photo", file);
  if (caption) formData.append("caption", caption);
  return apiUpload<GalleryPhotoDto>("/website/gallery", formData);
}

export function deleteGalleryPhoto(id: number) {
  return apiDelete<void>(`/website/gallery/${id}`);
}

export function fetchSiteDocuments() {
  return apiGet<SiteDocumentDto[]>("/website/documents");
}

export function uploadSiteDocument(file: File, title: string, category?: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  if (category) formData.append("category", category);
  return apiUpload<SiteDocumentDto>("/website/documents", formData);
}

export function deleteSiteDocument(id: number) {
  return apiDelete<void>(`/website/documents/${id}`);
}
