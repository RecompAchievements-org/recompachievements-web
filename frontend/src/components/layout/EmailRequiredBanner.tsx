import Link from "next/link";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { getCurrentAccount } from "@/lib/auth/session";

/** A thin notice under the header for signed-in accounts without a confirmed email: they can't
 *  collect achievements until they add and verify one. Renders nothing for everyone else; the
 *  layout puts it inside <Suspense> because it reads the session cookie.
**/
export async function EmailRequiredBanner() {
  const account = await getCurrentAccount();
  if (!account || account.canCollectAchievements) return null;

  const locale = await getLocale();
  const { auth } = await getMessages();
  return (
    <div role="status" className="border-b border-gold/30 bg-surface">
      <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm text-gold sm:px-6">
        <span>{auth.emailRequiredBanner}</span>
        <Link href={localizePath(locale, "/account/settings")} className="font-semibold underline hover:text-foreground">
          {auth.emailRequiredAction}
        </Link>
      </p>
    </div>
  );
}
