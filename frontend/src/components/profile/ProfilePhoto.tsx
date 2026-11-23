import { cx } from "@/lib/cx";

/** A player's square profile photo. Every account shows this original placeholder until photo
 *  uploads exist. Without a label it's decorative and hidden from screen readers.
**/
export function ProfilePhoto({ label, className }: { label?: string; className?: string }) {
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
