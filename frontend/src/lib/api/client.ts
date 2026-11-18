import "server-only";

/** Server-only client for the RecompAchievements API. The base URL and internal key come from
 *  server environment variables and are never sent to the browser; the visitor's IP is forwarded
 *  so the API can rate-limit per visitor instead of per website server.
**/

export interface ProblemDetails {
  status?: number;
  title?: string;
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

export async function apiPost<T>(
  path: string,
  body: unknown,
  options: { clientIp?: string | null } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Internal-Key": requireEnv("API_INTERNAL_KEY"),
  };
  if (options.clientIp) headers["X-Client-IP"] = options.clientIp;

  const response = await fetch(new URL(path, requireEnv("API_BASE_URL")), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const payload: unknown = response.headers.get("content-type")?.includes("json")
    ? await response.json()
    : undefined;

  return response.ok
    ? { ok: true, status: response.status, data: payload as T }
    : { ok: false, status: response.status, problem: payload as ProblemDetails | undefined };
}
