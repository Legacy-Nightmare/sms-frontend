
 // Standalone fetch client for the public homepage — deliberately NOT
// reusing lib/api.ts. That client always attaches an auth token when one
// exists in localStorage and treats any 401 as "session expired" (clearing
// the token and firing the global sign-out handler), which would misfire
// for a public, never-logged-in visitor hitting an endpoint that doesn't
// need auth at all.

const API_BASE_URL =
  import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8082";

export class PublicApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

// A 429 carries the backend's user-facing "wait a minute" message (F-31) —
// surface it instead of the generic status line.
async function publicError(res: Response, path: string) {
  let message = `Request to ${path} failed (${res.status})`;
  if (res.status === 429) {
    const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
    if (typeof body?.message === "string") message = body.message;
  }
  return new PublicApiError(res.status, message);
}

export async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/public${path}`);

  if (!res.ok) throw await publicError(res, path);

  return res.json() as Promise<T>;
}

export async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/public${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw await publicError(res, path);

  return res.json() as Promise<T>;
}

// Resolve uploaded-file URLs without incorrectly prefixing absolute URLs.
// RustFS public files use /sms-uploads/... and are served directly by Nginx.
export function resolvePublicAssetUrl(path: string): string {
  // If the backend already returns a complete URL, keep it unchanged.
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  // RustFS public bucket URLs are served from the frontend's current origin.
  if (path.startsWith("/sms-uploads/")) {
    return path;
  }

  // Other backend-relative file URLs, such as /uploads/...
  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  const relativePath = path.replace(/^\/+/, "");

  return `${baseUrl}/${relativePath}`;
}
