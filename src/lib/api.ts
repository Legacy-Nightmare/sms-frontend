const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8082";
const TOKEN_KEY = "shikkha_token";

export class ApiError extends Error {
  status: number;
  // The raw parsed error body, when there was one — lets callers that need
  // more than a flat message (e.g. per-row validation errors) read the
  // structured fields the backend sent instead of just a joined string.
  details: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Registered by AuthProvider so a 401 anywhere clears the session in React
// state, without this module needing to know about auth context or routing.
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  // FormData sets its own multipart boundary in the Content-Type header —
  // forcing application/json here would break the upload.
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    unauthorizedHandler?.();
    throw new ApiError(401, "Your session expired. Sign in again.");
  }

  if (!res.ok) {
    let message = res.statusText;
    let details: unknown;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? message);
      details = body;
    } catch {
      // body wasn't JSON — fall back to statusText
    }
    throw new ApiError(res.status, message, details);
  }

  // Several endpoints (e.g. POST /exams/:id/marks) return 200/201 with an
  // empty body, not 204 — res.json() throws a SyntaxError on empty text, so
  // checking status alone isn't enough. Read as text first and only parse
  // when there's actually something to parse.
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>(
    path,
    body !== undefined ? { method: "POST", body: JSON.stringify(body) } : { method: "POST" },
  );
export const apiPut = <T>(path: string, body?: unknown) =>
  request<T>(
    path,
    body !== undefined ? { method: "PUT", body: JSON.stringify(body) } : { method: "PUT" },
  );
export const apiDelete = <T>(path: string) => request<T>(path, { method: "DELETE" });
export const apiUpload = <T>(path: string, formData: FormData) =>
  request<T>(path, { method: "POST", body: formData });
