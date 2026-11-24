import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { FormMessage, SubmitButton } from "@/components/auth/FormParts";
import { PlatformIcon } from "@/components/auth/PlatformIcon";
import { platformNames } from "@/components/auth/platformNames";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { localizePath, type Locale } from "@/i18n/config";
import { formatDate, interpolate } from "@/i18n/format";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { getPlatforms, platforms, type Platform } from "@/lib/api/accounts";
import { isAuthError } from "@/lib/auth/forms";
import { getCurrentAccount, getEmailOffer } from "@/lib/auth/session";
import { siteConfig } from "@/lib/site";
import { startPlatform } from "../../auth/actions";
import { dismissEmailOffer, signOutAction } from "./actions";
import { DisconnectButton } from "./DisconnectButton";
import { AddEmailForm } from "./EmailForms";
import { PasswordLinkForm } from "./PasswordLinkForm";
import { PhotoForm } from "./PhotoForm";

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
  const { auth, moderation } = await getMessages();
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
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)]">
          <InfoRow label={copy.usernameLabel}>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="wrap-anywhere">{account.username}</span>
              {account.isAlphaTester && <Badge tone="gold">{copy.alphaTester}</Badge>}
            </span>
          </InfoRow>
          <InfoRow label={copy.accountTypeLabel}>{moderation.actions.roles[account.role]}</InfoRow>
          <InfoRow label={copy.memberSinceLabel}>{longDate(locale, account.createdAt)}</InfoRow>
          <InfoRow label={copy.lastActivityLabel}>{longDate(locale, account.lastActivityAt)}</InfoRow>
        </dl>
      </Section>

      {/** Shown to every player, so the absence of a penalty is stated as clearly as one. **/}
      <Section title={copy.standingHeading}>
        {account.isMuted && account.mutedUntil ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="gold">{copy.standingMutedBadge}</Badge>
              <span className="text-sm font-semibold">
                {interpolate(copy.standingMutedUntil, {
                  date: formatDate(locale, new Date(account.mutedUntil), { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }),
                })}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted">{copy.standingMutedBody}</p>
            <p className="text-sm leading-relaxed text-muted">
              {rich(copy.standingAppeal, {
                email: (
                  <a href={`mailto:${siteConfig.contactEmail}`} className="text-accent underline hover:text-accent-strong">
                    {siteConfig.contactEmail}
                  </a>
                ),
              })}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="success">{copy.standingNone}</Badge>
            <span className="text-sm text-muted">{copy.standingGood}</span>
          </div>
        )}
      </Section>

      <Section title={auth.photo.heading} intro={auth.photo.intro}>
        {account.canCollectAchievements ? (
          <PhotoForm
            avatar={account.avatar}
            muted={account.isMuted}
            messages={auth.photo}
            errors={auth.errors}
            rulesHref={localizePath(locale, "/rules")}
          />
        ) : (
          <p className="text-sm text-subtle">{auth.photo.needsEmail}</p>
        )}
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
                  <span className="inline-flex items-center gap-2 font-semibold" translate="no">
                    <PlatformIcon platform={platform} />
                    {platformNames[platform]}
                  </span>
                  <Badge tone={connected[platform] ? "success" : "neutral"}>
                    {connected[platform] ? copy.connected : copy.notConnected}
                  </Badge>
                </div>
                {connected[platform] ? (
                  <DisconnectButton platform={platform} locale={locale} messages={copy} />
                ) : (
                  <form action={startPlatform}>
                    <input type="hidden" name="platform" value={platform} />
                    <input type="hidden" name="mode" value="connect" />
                    <input type="hidden" name="locale" value={locale} />
                    <SubmitButton
                      variant="secondary"
                      icon={<PlatformIcon platform={platform} />}
                      label={copy.connect}
                      pendingLabel={copy.connect}
                      className="w-full sm:w-auto"
                    />
                  </form>
                )}
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

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="-mt-2 font-semibold sm:mt-0">{children}</dd>
    </>
  );
}

const longDate = (locale: Locale, value: string) => formatDate(locale, new Date(value), { dateStyle: "long", timeZone: "UTC" });

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
      {[4, 1, 3, 2, 3, 2].map((lines, index) => (
        <Card key={index} className="flex flex-col gap-4 p-5 sm:p-6">
          <SkeletonText widths={["w-32"]} className="font-display text-xl" />
          <SkeletonText widths={Array.from({ length: lines }, (_, line) => (line === lines - 1 ? "w-1/2" : "w-full"))} />
        </Card>
      ))}
      <Skeleton className="h-11 w-full rounded-lg sm:w-28" />
    </div>
  );
}
