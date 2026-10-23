import type { Role } from "@/lib/auth";

// Single source of truth for which role can see which page — the Sidebar
// filters its nav items from this, and SchoolApp redirects away from a page
// the current role isn't allowed on. The backend enforces the same roles
// independently on every endpoint; this only controls what's shown/visited
// client-side.
export type Page =
  "dashboard" | "students" | "classes" | "attendance" | "exams" | "notices" | "staff" | "finance" | "website";

export const PAGE_ROLES: Record<Page, Role[]> = {
  dashboard: ["admin", "teacher"],
  students: ["admin", "teacher"],
  classes: ["admin", "teacher"],
  attendance: ["admin", "teacher"],
  exams: ["admin", "teacher"],
  notices: ["admin", "teacher"],
  staff: ["admin"],
  finance: ["admin", "finance"],
  website: ["admin"],
};

export function canAccessPage(role: Role | undefined, page: Page): boolean {
  if (!role) return false;
  return PAGE_ROLES[page].includes(role);
}

export function defaultPageFor(role: Role): Page {
  return role === "finance" ? "finance" : "dashboard";
}
