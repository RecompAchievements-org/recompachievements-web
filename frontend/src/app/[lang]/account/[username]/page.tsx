import type { Metadata } from "next";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ReportButton } from "@/components/moderation/ReportButton";
import { ProfileBadges, ProfileBadgesSkeleton } from "@/components/profile/ProfileBadges";
import { ProfileCard, ProfileCardSkeleton } from "@/components/profile/ProfileCard";
import { ProfileSampleSections, ProfileSampleSectionsSkeleton } from "@/components/profile/ProfileSampleSections";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { getPublicPlayer, type PublicPlayer } from "@/lib/api/accounts";
import { getWallPage, type WallPage } from "@/lib/api/walls";
import { usernamePattern } from "@/lib/auth/forms";
import { getCurrentAccount, visitor } from "@/lib/auth/session";
import { WallComments } from "./WallComments";

type Props = PageProps<"/[lang]/account/[username]">;

const profileActionClasses = "min-h-11 flex-1 text-center";

function readUsername(raw: string): string | null {
  try {
    const username = decodeURIComponent(raw);
    return usernamePattern.test(username) ? username : null;
  } catch {
    return null;
  }
}

// Public by link, but out of search results until moderation and real scores exist.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const { profile } = await getMessages();
  return { title: readUsername(username) ?? profile.metaTitle, robots: { index: false, follow: false } };
}

export default async function ProfilePage({ params }: Props) {
  const { profile } = await getMessages();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <Suspense fallback={<ProfileSkeleton label={profile.loading} />}>
        <ProfilePanel params={params} />
      </Suspense>
    </div>
  );
}

/** The public profile. It renders only public player data (never the /me account), so nothing
 *  private can reach a visitor's page.
**/
async function ProfilePanel({ params }: Pick<Props, "params">) {
  const { username: raw } = await params;
  const username = readUsername(raw);
  if (!username) notFound();

  const locale = await getLocale();
  const { profile, auth, comments, moderation } = await getMessages();

  let player: PublicPlayer;
  let wall: WallPage | null = null;
  const context = await visitor();
  try {
    const result = await getPublicPlayer(username, context);
    if (!result.ok && result.status === 404) notFound();
    if (!result.ok) throw new Error(`Loading the player failed with status ${result.status}.`);
    player = result.data;
    // One address per player: other casings go to the real username.
    if (player.username !== username) redirect(localizePath(locale, `/account/${player.username}`));

    const page = await getWallPage(player.username, null, locale, context);
    if (page.ok) wall = page.data;
  } catch (error) {
    unstable_rethrow(error);
    console.error("Profile unavailable", error);
    return <p className="text-muted">{profile.unavailable}</p>;
  }

  const viewer = await getCurrentAccount();
  const reportLabels = { ...moderation.report, reasons: moderation.reasons };
  const isOwner = viewer?.username === player.username;
  const access = !viewer ? "signIn" : viewer.canCollectAchievements ? "post" : "email";

  return (
    <>
      <ProfileGrid
        aside={
          <ProfileCard
            player={player}
            actions={
              <>
                <ButtonLink href={localizePath(locale, `/progress/${player.username}`)} variant="secondary" size="sm" className={profileActionClasses}>
                  {profile.progressLink}
                </ButtonLink>
                {isOwner && (
                  <ButtonLink href={localizePath(locale, "/account/settings")} variant="secondary" size="sm" className={profileActionClasses}>
                    {profile.settingsLink}
                  </ButtonLink>
                )}
                {viewer && !isOwner && (
                  <ReportButton
                    username={player.username}
                    targets={player.avatar ? ["profile", "photo"] : ["profile"]}
                    labels={reportLabels}
                    errors={auth.errors}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-danger/50 px-3 text-sm font-semibold text-danger transition-colors hover:border-danger hover:bg-danger/10"
                  />
                )}
              </>
            }
          />
        }
      >
        <ProfileBadges player={player} />
        <ProfileSampleSections username={player.username} />
      </ProfileGrid>
      {/** The wall uses the page's full width, like the comments on a game page. **/}
      {wall ? (
        <WallComments
          username={player.username}
          locale={locale}
          first={wall}
          access={access}
          messages={profile.wall}
          errors={auth.errors}
          authorLabels={comments.author}
          viewerUsername={viewer?.username ?? null}
          mutedNotice={viewer?.isMuted ? comments.muted : null}
          reportLabels={reportLabels}
        />
      ) : (
        <p className="text-muted">{profile.wall.unavailable}</p>
      )}
    </>
  );
}

// Player sections on the left and the profile card on the right; on phones the card comes first.
function ProfileGrid({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <aside className="min-w-0 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1">{aside}</aside>
      <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1">{children}</div>
    </div>
  );
}

// Same layout as the loaded page, so nothing shifts when it arrives.
function ProfileSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-6">
      <ProfileGrid aside={<ProfileCardSkeleton />}>
        <ProfileBadgesSkeleton />
        <ProfileSampleSectionsSkeleton />
      </ProfileGrid>
      <SkeletonText widths={["w-24"]} className="font-display text-2xl" />
      <SkeletonText widths={["w-2/3"]} />
      <Skeleton className="h-52 w-full rounded-2xl" />
    </div>
  );
}
