import { cx } from "@/lib/cx";
import { consoleFamily, consoleName } from "./names";

const familyClasses = {
  playstation: "border-console-playstation/50 bg-console-playstation/15 text-console-playstation",
  nintendo: "border-console-nintendo/50 bg-console-nintendo/15 text-console-nintendo",
  xbox: "border-console-xbox/50 bg-console-xbox/15 text-console-xbox",
} as const;

/** The game's original console as a pill in its brand family's color, so it stands out at a
 *  glance. `label` is the full sentence for screen readers ("Originally on PlayStation 4").
**/
export function ConsolePill({ originalPlatform, label }: { originalPlatform: string; label: string }) {
  const family = consoleFamily(originalPlatform);
  return (
    <p
      className={cx(
        "inline-flex self-start rounded-full border px-3 py-1 text-sm font-semibold",
        family ? familyClasses[family] : "border-border-strong bg-surface-raised text-muted",
      )}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">{consoleName(originalPlatform)}</span>
    </p>
  );
}
