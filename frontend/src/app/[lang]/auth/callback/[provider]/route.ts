import { redirect, unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { isLocale, localizePath, type Locale } from "@/i18n/config";
import { completeOAuth, connectPlatform, isPlatform } from "@/lib/api/accounts";
import { errorFrom } from "@/lib/auth/forms";
import { getSessionToken, setEmailOffer, setPendingSignup, setSession, takeOAuthFlow, visitor } from "@/lib/auth/session";

/** Where Discord and GitHub send the visitor back (the redirect URL registered with each platform,
 *  always the unprefixed English path). The state must match the one saved when the flow started,
 *  so a link crafted by someone else can't sign the visitor in or connect a foreign account. The
 *  code and PKCE verifier then go to the API, which talks to the platform.
**/
export async function GET(request: NextRequest, ctx: RouteContext<"/[lang]/auth/callback/[provider]">) {
  const { provider } = await ctx.params;
  const query = request.nextUrl.searchParams;
  const code = query.get("code");
  const state = query.get("state");

  const flow = await takeOAuthFlow();
  const locale: Locale = flow && isLocale(flow.locale) ? flow.locale : "en";
  const page = (path: string, error?: string) => localizePath(locale, path) + (error ? `?error=${error}` : "");
  const back = flow?.mode === "connect" ? "/account/settings" : "/sign-in";

  if (!flow || !isPlatform(provider) || flow.platform !== provider || !state || state !== flow.state) {
    redirect(page(back, "flow"));
  }

  // The visitor declined on the platform's page (or it sent no code): back to where they started.
  if (!code) redirect(page(back));

  let target: string;
  try {
    if (flow.mode === "connect") {
      const session = await getSessionToken();
      if (!session) redirect(page("/sign-in", "not_signed_in"));

      const result = await connectPlatform(provider, code, flow.codeVerifier, await visitor());
      if (!result.ok) redirect(page("/account/settings", errorFrom(result)));
      if (result.data.emailOffer) await setEmailOffer({ email: result.data.emailOffer, platform: provider });
      target = page("/account/settings");
    } else {
      const result = await completeOAuth(provider, code, flow.codeVerifier, await visitor());
      if (!result.ok) redirect(page("/sign-in", errorFrom(result)));

      if (result.data.status === "signed-in") {
        await setSession(result.data.session.token);
        target = page("/account");
      } else {
        await setPendingSignup({
          pendingToken: result.data.pendingToken,
          platform: provider,
          email: result.data.email,
          suggestedUsername: result.data.suggestedUsername,
        });
        target = page("/welcome");
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error("Completing a platform sign-in failed", error);
    target = page(back, "unavailable");
  }

  redirect(target);
}
