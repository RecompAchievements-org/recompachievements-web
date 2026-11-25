import Image from "next/image";
import type { PlayerAvatar } from "@/lib/api/accounts";
import { cx } from "@/lib/cx";

const pixelSizes = { small: 96, large: 512 } as const;

/** The standard size of a player's main photo (Settings, staff account and report reviews): wide on
 *  phones, where it sits above the details, and a fixed square once it sits beside them.
**/
export const featuredPhotoClasses = "aspect-square h-auto w-full max-w-64 shrink-0 rounded-lg sm:size-40 sm:max-w-none";

/** A player's square profile photo, or an original placeholder when they have none. Photos skip the
 *  image optimizer, so a removed photo leaves no copy behind. Without a label it's decorative.
**/
export function ProfilePhoto({
  label,
  className,
  avatar,
  variant = "small",
}: {
  label?: string;
  className?: string;
  avatar?: PlayerAvatar | null;
  variant?: keyof typeof pixelSizes;
}) {
  if (avatar) {
    return (
      <Image
        src={avatar[variant]}
        alt={label ?? ""}
        width={pixelSizes[variant]}
        height={pixelSizes[variant]}
        unoptimized
        className={cx("shrink-0 bg-surface-raised object-cover", className)}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 96 96"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cx("shrink-0 bg-surface-raised", className)}
    >
      <circle cx="48" cy="36" r="17" className="fill-border-strong" />
      <path d="M14 96c2-24 16-37 34-37s32 13 34 37z" className="fill-border-strong" />
    </svg>
  );
}
