import "server-only";

/** Server-only client for the RecompAchievements API. The base URL and internal key come from
 *  server environment variables and are never sent to the browser. Requests made for a visitor
 *  forward their IP (so the API can rate-limit per visitor instead of per website server) and,
 *  when signed in, their session token; cached reads send neither.
**/

export interface ProblemDetails {
  status?: number;
  title?: string;
  // Machine-readable reason some endpoints add (e.g. "username_taken"); the website translates it.
  code?: string;
  errors?: Record<string, string[]>;
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; problem?: ProblemDetails };

const timeoutMs = 8000;

function requireEnv(name: "API_BASE_URL" | "API_INTERNAL_KEY"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

/** GET without visitor context: the website caches these results and shares them between
 *  visitors, so they must not depend on who asked.
**/
export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const response = await fetch(new URL(path, requireEnv("API_BASE_URL")), {
    headers: { Accept: "application/json", "X-Internal-Key": requireEnv("API_INTERNAL_KEY") },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  return toResult<T>(response);
}

export interface VisitorContext {
  clientIp?: string | null;
  // The visitor's session token, sent as a bearer token; never cached or shared between visitors.
  session?: string | null;
}

export function apiPost<T>(path: string, body: unknown, visitor: VisitorContext = {}): Promise<ApiResult<T>> {
  return apiSend<T>("POST", path, body, visitor);
}

// A request made for one visitor (their IP and session); its result is never cached.
export async function apiSend<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body: unknown,
  visitor: VisitorContext = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Internal-Key": requireEnv("API_INTERNAL_KEY"),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (visitor.clientIp) headers["X-Client-IP"] = visitor.clientIp;
  if (visitor.session) headers.Authorization = `Bearer ${visitor.session}`;

  const response = await fetch(new URL(path, requireEnv("API_BASE_URL")), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  return toResult<T>(response);
}

// Sends a file's bytes for one visitor; used only for profile photos.
export async function apiUpload<T>(path: string, content: ArrayBuffer, visitor: VisitorContext = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/octet-stream",
    "X-Internal-Key": requireEnv("API_INTERNAL_KEY"),
  };
  if (visitor.clientIp) headers["X-Client-IP"] = visitor.clientIp;
  if (visitor.session) headers.Authorization = `Bearer ${visitor.session}`;

  const response = await fetch(new URL(path, requireEnv("API_BASE_URL")), {
    method: "PUT",
    headers,
    body: content,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  return toResult<T>(response);
}

async function toResult<T>(response: Response): Promise<ApiResult<T>> {
  const payload: unknown = response.headers.get("content-type")?.includes("json")
    ? await response.json()
    : undefined;

  return response.ok
    ? { ok: true, status: response.status, data: payload as T }
    : { ok: false, status: response.status, problem: payload as ProblemDetails | undefined };
}
