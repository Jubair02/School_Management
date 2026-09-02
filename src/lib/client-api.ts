/**
 * EduSphere — typed fetch wrapper for all client → API communication.
 * Relative URLs only. Errors are normalized into ApiError (message + status).
 * A 401 dispatches a global event so the AuthProvider can log the user out.
 */

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const UNAUTHORIZED_EVENT = "edusphere:unauthorized";

/* ── Bearer-token session store ─────────────────────────────────────────
 * Cookies can be blocked when the app runs inside a cross-site iframe
 * (e.g. preview panels) or in incognito. The login response therefore also
 * carries the JWT, which we persist here and send via `Authorization` on
 * every request. Access is guarded — some browsers throw on storage access
 * in third-party frames, in which case we silently fall back to cookies.
 * ───────────────────────────────────────────────────────────────────────*/
const TOKEN_KEY = "edusphere.auth-token";

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (third-party frame restrictions) — cookie-only mode
  }
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
  };

  init.headers = {};
  if (opts.body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  const token = getStoredToken();
  if (token) {
    init.headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError("Network error — please check your connection and try again.", 0);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data: unknown = await res.json();
      if (
        data &&
        typeof data === "object" &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
      ) {
        message = (data as { error: string }).error;
      }
    } catch {
      // response had no JSON body — keep the default message
    }

    if (res.status === 401 && typeof window !== "undefined") {
      setStoredToken(null); // drop any stale/invalid token
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }

    throw new ApiError(message, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Build a "?a=1&b=x" query string, skipping empty values. */
export function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
