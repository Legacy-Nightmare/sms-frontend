// Standalone fetch client for the public homepage — deliberately NOT
// reusing lib/api.ts. That client always attaches an auth token when one
// exists in localStorage and treats any 401 as "session expired" (clearing
// the token and firing the global sign-out handler), which would misfire
// for a public, never-logged-in visitor hitting an endpoint that doesn't
// need auth at all.
const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8082";

export class PublicApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

export async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/public${path}`);
  if (!res.ok) {
    throw new PublicApiError(res.status, `Request to ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// Uploaded files (gallery photos, documents, logo) come back as paths
// relative to the backend (e.g. "/uploads/website/gallery/..."), not the
// frontend's own origin — this resolves them to a fetchable/linkable URL.
export function resolvePublicAssetUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
