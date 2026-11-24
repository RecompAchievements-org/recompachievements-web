import Link from "next/link";
import { localizePath } from "@/i18n/config";
import { interpolate } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { AccountMenu } from "./AccountMenu";

/** The header's account entry: "Sign In", or the signed-in player's photo, name, and menu. Phones
 *  show only the icon or photo, and the username appears from tablet widths up (the label stays as
 *  its accessible name), to keep the header on one line. It reads the session cookie, so the header
 *  renders it inside <Suspense> with SignInLink as the fallback.
**/
export async function AccountLink() {
  const account = await getCurrentAccount();
  if (!account) return <SignInLink />;

  const locale = await getLocale();
  const { header, auth } = await getMessages();
  const menu = header.accountMenu;
  const profileHref = localizePath(locale, `/account/${account.username}`);

  return (
    <AccountMenu
      username={account.username}
      avatar={account.avatar}
      profileHref={profileHref}
      buttonLabel={interpolate(header.account, { username: account.username })}
      menuLabel={menu.label}
      locale={locale}
      signOutLabel={auth.account.signOut}
      signingOutLabel={auth.account.signingOut}
      items={[
        { href: profileHref, label: menu.profile, icon: "profile" },
        { href: localizePath(locale, `/progress/${account.username}`), label: menu.progress, icon: "progress" },
        { href: localizePath(locale, "/account/messages"), label: menu.messages, icon: "messages" },
        { href: localizePath(locale, "/account/settings"), label: menu.settings, icon: "settings" },
        ...(account.role === "player" ? [] : [{ href: localizePath(locale, "/moderation"), label: menu.moderation, icon: "moderation" as const, separated: true }]),
      ]}
    />
  );
}

export async function SignInLink() {
  const locale = await getLocale();
  const { header } = await getMessages();
  return (
    <Link
      href={localizePath(locale, "/sign-in")}
      aria-label={header.signIn}
      className="flex h-9 items-center gap-2 rounded-md px-1.5 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:bg-surface-raised hover:text-foreground sm:px-3"
    >
      <PersonIcon />
      <span className="hidden sm:inline">{header.signIn}</span>
    </Link>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5 shrink-0">
      <circle cx="10" cy="6.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 17c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
