import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { FormMessage, SubmitButton } from "@/components/auth/FormParts";
import { platformNames } from "@/components/auth/platformNames";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { localizePath } from "@/i18n/config";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { getPlatforms, platforms, type Platform } from "@/lib/api/accounts";
import { isAuthError } from "@/lib/auth/forms";
import { getCurrentAccount, getEmailOffer } from "@/lib/auth/session";
import { startPlatform } from "../../auth/actions";
import { disconnectAction, dismissEmailOffer, signOutAction } from "./actions";
import { AddEmailForm } from "./EmailForms";
import { PasswordLinkForm } from "./PasswordLinkForm";

export async function generateMetadata(): Promise<Metadata> {
  const { auth } = await getMessages();
  return { title: auth.settings.metaTitle, robots: { index: false, follow: false } };
}

export default async function SettingsPage({ searchParams }: PageProps<"/[lang]/account/settings">) {
  const { auth } = await getMessages();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{auth.settings.title}</h1>
      {/** Private: depends on who is signed in, so it renders per request. **/}
      <Suspense fallback={<SettingsSkeleton label={auth.settings.loading} />}>
        <SettingsPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SettingsPanel({ searchParams }: Pick<PageProps<"/[lang]/account/settings">, "searchParams">) {
  const locale = await getLocale();
  const { auth } = await getMessages();
  const account = await getCurrentAccount();
  if (!account) redirect(localizePath(locale, "/sign-in"));

  const { error } = await searchParams;
  const offer = account.canCollectAchievements ? null : await getEmailOffer();
  const copy = auth.account;
  const settings = auth.settings;

  // Platforms the API offers, plus any already connected (so they can still be disconnected).
  let offered: Platform[] = [];
  try {
    offered = await getPlatforms();
  } catch (caught) {
    console.error("Loading sign-in platforms failed", caught);
  }
  const connected: Record<Platform, boolean> = { discord: account.discordConnected, github: account.githubConnected };
  const shown = platforms.filter((platform) => offered.includes(platform) || connected[platform]);

  return (
    <div className="flex flex-col gap-6">
      {typeof error === "string" && isAuthError(error) && <FormMessage message={auth.errors[error]} />}

      <Section title={copy.profileHeading}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm text-muted">{copy.usernameLabel}</span>
          <span className="font-semibold wrap-anywhere">{account.username}</span>
          {account.isAlphaTester && <Badge tone="gold">{copy.alphaTester}</Badge>}
        </div>
      </Section>

      <Section title={copy.emailHeading}>
        {account.canCollectAchievements ? (
          <div className="flex flex-col gap-1">
            <p className="font-semibold wrap-anywhere">{account.email}</p>
            <p className="text-sm text-success">{copy.emailConfirmed}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {offer && (
              <div className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface-raised p-4">
                <h3 className="font-semibold">{copy.offerTitle}</h3>
                <p className="text-sm text-muted">
                  {rich(copy.offerBody, {
                    email: <strong className="text-foreground wrap-anywhere">{offer.email}</strong>,
                    platform: <span translate="no">{platformNames[offer.platform]}</span>,
                  })}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <AddEmailForm locale={locale} messages={auth} offer={offer.email} />
                  <form action={dismissEmailOffer}>
                    <input type="hidden" name="locale" value={locale} />
                    <SubmitButton variant="secondary" label={copy.offerDismiss} pendingLabel={copy.offerDismiss} className="w-full sm:w-auto" />
                  </form>
                </div>
              </div>
            )}
            <p className="text-gold">{copy.noEmailBody}</p>
            <AddEmailForm locale={locale} messages={auth} />
          </div>
        )}
      </Section>

      {shown.length > 0 && (
        <Section title={copy.platformsHeading} intro={copy.platformsIntro}>
          <ul className="flex flex-col divide-y divide-border">
            {shown.map((platform) => (
              <li key={platform} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold" translate="no">
                    {platformNames[platform]}
                  </span>
                  <Badge tone={connected[platform] ? "success" : "neutral"}>
                    {connected[platform] ? copy.connected : copy.notConnected}
                  </Badge>
                </div>
                <form action={connected[platform] ? disconnectAction : startPlatform}>
                  <input type="hidden" name="platform" value={platform} />
                  <input type="hidden" name="mode" value="connect" />
                  <input type="hidden" name="locale" value={locale} />
                  <SubmitButton
                    variant="secondary"
                    label={connected[platform] ? copy.disconnect : copy.connect}
                    pendingLabel={connected[platform] ? copy.disconnect : copy.connect}
                    className="w-full sm:w-auto"
                  />
                </form>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/** The wording depends on whether this changes a password or sets the account's first one. **/}
      <Section title={account.hasPassword ? settings.changePasswordHeading : settings.setPasswordHeading}>
        <p className="text-muted">{account.hasPassword ? settings.changePasswordBody : settings.setPasswordBody}</p>
        {account.canCollectAchievements ? (
          <PasswordLinkForm
            locale={locale}
            label={account.hasPassword ? settings.changePasswordButton : settings.setPasswordButton}
            messages={auth}
          />
        ) : (
          <p className="text-sm text-subtle">{settings.passwordNeedsEmail}</p>
        )}
      </Section>

      <form action={signOutAction}>
        <input type="hidden" name="locale" value={locale} />
        <SubmitButton variant="secondary" label={copy.signOut} pendingLabel={copy.signingOut} className="w-full sm:w-auto" />
      </form>
    </div>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {intro && <p className="text-sm text-muted">{intro}</p>}
      </div>
      {children}
    </Card>
  );
}

// Same cards as the loaded page (heading plus a few lines each), so nothing shifts when it arrives.
function SettingsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-6">
      {[1, 2, 3, 2].map((lines, index) => (
        <Card key={index} className="flex flex-col gap-4 p-5 sm:p-6">
          <SkeletonText widths={["w-32"]} className="font-display text-xl" />
          <SkeletonText widths={Array.from({ length: lines }, (_, line) => (line === lines - 1 ? "w-1/2" : "w-full"))} />
        </Card>
      ))}
      <Skeleton className="h-11 w-full rounded-lg sm:w-28" />
    </div>
  );
}
