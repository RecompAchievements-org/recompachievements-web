import Link from "next/link";
import { LogoMark } from "@/components/layout/Logo";
import { ProfilePhoto } from "@/components/profile/ProfilePhoto";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { localizePath, type Locale } from "@/i18n/config";
import { formatDate, interpolate } from "@/i18n/format";
import type { Messages } from "@/i18n/server";
import type { PlayerAvatar } from "@/lib/api/accounts";
import type { ForumPostSummary } from "@/lib/api/forum";

export const forumDate = (locale: Locale, value: string) => formatDate(locale, new Date(value), { dateStyle: "long", timeZone: "UTC" });

// Who wrote a post: a player's photo and profile link, or the team mark for posts without an author.
export function ForumAuthor({
  locale,
  username,
  avatar,
  team,
}: {
  locale: Locale;
  username: string | null;
  avatar?: PlayerAvatar | null;
  team: string;
}) {
  return username ? (
    <Link href={localizePath(locale, `/account/${username}`)} className="inline-flex min-w-0 items-center gap-2 font-semibold text-foreground hover:text-accent">
      <ProfilePhoto avatar={avatar} className="size-6 rounded" />
      <span className="wrap-anywhere">{username}</span>
    </Link>
  ) : (
    <span className="inline-flex items-center gap-2 font-semibold text-foreground">
      <LogoMark className="size-6" />
      {team}
    </span>
  );
}

export function PostCard({
  locale,
  category,
  post,
  copy,
  showStatus = false,
}: {
  locale: Locale;
  category: string;
  post: ForumPostSummary;
  copy: Messages["forum"];
  showStatus?: boolean;
}) {
  const href = localizePath(locale, post.status === "published" ? `/forum/${category}/${post.slug}` : `/forum/${category}/${post.slug}/edit`);
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-subtle">
        {post.pinned && (
          <span className="rounded-md border border-accent/40 px-1.5 py-0.5 text-xs font-semibold text-accent uppercase">{copy.pinnedBadge}</span>
        )}
        {showStatus && post.status === "draft" && (
          <span className="rounded-md border border-gold/40 px-1.5 py-0.5 text-xs font-semibold text-gold uppercase">{copy.draftBadge}</span>
        )}
        <span>{post.publishedAt ? forumDate(locale, post.publishedAt) : interpolate(copy.createdOn, { date: forumDate(locale, post.createdAt) })}</span>
        <span aria-hidden="true">·</span>
        <span>{post.authorUsername ?? copy.team}</span>
      </div>
      <h2 className="font-display text-xl font-semibold wrap-anywhere sm:text-2xl">
        <Link href={href} className="hover:text-accent">
          {post.title}
        </Link>
      </h2>
      {post.excerpt && <p className="leading-relaxed text-muted wrap-anywhere">{post.excerpt}</p>}
    </Card>
  );
}

export function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="flex flex-col gap-3 p-5">
          <SkeletonText widths={["w-48"]} className="text-sm" />
          <SkeletonText widths={["w-3/4"]} className="font-display text-xl sm:text-2xl" />
          <SkeletonText widths={["w-full", "w-2/3"]} className="leading-relaxed" />
        </Card>
      ))}
    </div>
  );
}

export function ForumHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-24" />
      <SkeletonText widths={["w-48"]} className="font-display text-4xl sm:text-5xl" />
      <SkeletonText widths={["w-full", "w-1/2"]} className="text-lg leading-relaxed" />
    </div>
  );
}
