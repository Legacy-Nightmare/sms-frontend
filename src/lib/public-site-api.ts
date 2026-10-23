import { publicGet } from "@/lib/public-api";

export interface PublicNoticeDto {
  id: number;
  title: string;
  body: string;
  classEntity: { id: number; name: string } | null;
  publishedToWebsiteAt: string;
}

export interface PublicResultAnnouncementDto {
  id: number;
  name: string;
  type: "tutorial" | "final";
  academicYear: string | null;
  examDate: string | null;
  classEntity: { id: number; name: string };
  resultsAnnouncedAt: string;
}

export interface SchoolProfileDto {
  id: number;
  schoolName: string;
  tagline: string | null;
  aboutText: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  mapUrl: string | null;
  facebookUrl: string | null;
  youtubeUrl: string | null;
  linkedinUrl: string | null;
  xUrl: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  updatedAt: string;
}

export interface InstitutionDto {
  id: number;
  name: string;
  caption: string | null;
  tone: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface GalleryPhotoDto {
  id: number;
  imageUrl: string;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface SiteDocumentDto {
  id: number;
  title: string;
  fileUrl: string;
  category: string | null;
  createdAt: string;
}

export interface PublicSiteDto {
  profile: SchoolProfileDto;
  institutions: InstitutionDto[];
  gallery: GalleryPhotoDto[];
  documents: SiteDocumentDto[];
}

export function fetchPublicSite() {
  return publicGet<PublicSiteDto>("/site");
}

export function fetchPublicNotices() {
  return publicGet<PublicNoticeDto[]>("/notices");
}

export function fetchPublicResultsAnnouncements() {
  return publicGet<PublicResultAnnouncementDto[]>("/results-announcements");
}
