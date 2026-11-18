import "server-only";

/** Server-side check of the human-verification token from the sign-up form. Each token is
 *  single-use and must be confirmed with the provider before the form is accepted. Without a
 *  configured secret every check fails (fail closed), so a missing setting can't silently turn the
 *  protection off.
**/

const verifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const timeoutMs = 5000;

interface VerifyResponse {
  success: boolean;
  action?: string;
  "error-codes"?: string[];
}

export async function verifyHumanToken(
  token: string,
  expectedAction: string,
  clientIp: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not configured; rejecting the submission.");
    return false;
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (clientIp) body.set("remoteip", clientIp);

  try {
    const response = await fetch(verifyUrl, {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;

    const result = (await response.json()) as VerifyResponse;
    // Test keys report no action; real keys must match the form's action.
    return result.success && (result.action === undefined || result.action === expectedAction);
  } catch (error) {
    console.error("Human verification request failed", error);
    return false;
  }
}
