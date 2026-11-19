import Link from "next/link";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { localizePath } from "@/i18n/config";
import { interpolate } from "@/i18n/format";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import type { ArtImage, GameArt } from "@/lib/api/games";

/** Credits for a game's SteamGridDB art, shown below the comments: each image with its artist and
 *  a link to its SteamGridDB page, plus the ownership notice. Renders nothing without art.
**/
export async function GameArtCredits({ art }: { art: GameArt }) {
  const locale = await getLocale();
  const { artCredits } = await getMessages();
  const images: [string, ArtImage | null][] = [
    [artCredits.cover, art.cover],
    [artCredits.hero, art.hero],
    [artCredits.icon, art.icon],
  ];
  const shown = images.filter((entry): entry is [string, ArtImage] => entry[1] !== null);
  if (shown.length === 0) return null;

  return (
    <section aria-labelledby="art-credits-heading" className="flex flex-col gap-3 border-t border-border pt-6 text-sm">
      <h2 id="art-credits-heading" className="font-display text-lg font-semibold">
        {artCredits.heading}
      </h2>
      <ul className="flex flex-col gap-1 text-muted">
        {shown.map(([label, image]) => (
          <li key={label}>
            <span className="text-foreground">{label}</span>{" "}
            <ExternalLink href={image.sourceUrl} className="underline hover:text-foreground">
              {interpolate(artCredits.by, { author: image.author })}
            </ExternalLink>
          </li>
        ))}
      </ul>
      <p className="text-subtle">{artCredits.source}</p>
      <p className="leading-relaxed text-subtle">
        {rich(artCredits.disclaimer, {
          policy: (
            <Link href={localizePath(locale, "/content-policy")} className="underline hover:text-foreground">
              {artCredits.policyLink}
            </Link>
          ),
        })}
      </p>
    </section>
  );
}
