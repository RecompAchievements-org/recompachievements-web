import { Badge } from "@/components/ui/Badge";
import { plural } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import type { Achievement } from "@/lib/api/games";

// Icon frame colors per rarity tier; placeholder icons until developers upload their own.
const iconClasses = {
  common: "border-rarity-common/40 text-rarity-common",
  uncommon: "border-rarity-uncommon/40 text-rarity-uncommon",
  rare: "border-rarity-rare/40 text-rarity-rare",
  epic: "border-rarity-epic/40 text-rarity-epic",
  legendary: "border-rarity-legendary/40 text-rarity-legendary",
} as const;

export async function AchievementRow({ achievement: item }: { achievement: Achievement }) {
  const locale = await getLocale();
  const { achievement, rarity, game } = await getMessages();

  return (
    <li className="flex items-start gap-4 rounded-xl border border-border bg-surface p-4">
      <div
        aria-hidden="true"
        className={`grid size-12 shrink-0 place-items-center rounded-lg border bg-surface-raised font-display text-xl ${iconClasses[item.rarityTier]}`}
      >
        ★
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-semibold">{item.title}</h3>
        <p className="text-sm text-muted">{item.description}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Badge tone="gold">{plural(locale, item.points, achievement.points)}</Badge>
          <Badge tone={item.rarityTier}>{rarity[item.rarityTier]}</Badge>
          {item.kind !== "standard" && <Badge>{game.kind[item.kind]}</Badge>}
        </div>
      </div>
    </li>
  );
}
