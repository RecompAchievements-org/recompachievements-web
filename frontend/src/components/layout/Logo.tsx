import { cx } from "@/lib/cx";

// The hexagon-and-star mark; keep in sync with src/app/icon.svg.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cx("size-7 shrink-0 min-[400px]:size-8", className)}>
      <path
        d="M16 2 28 9v14l-12 7-12-7V9z"
        className="fill-surface-raised stroke-accent"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M16 9l1.7 4.65 4.96.19-3.9 3.06 1.35 4.76L16 18.9l-4.11 2.76 1.35-4.76-3.9-3.06 4.96-.19z"
        className="fill-gold"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("flex items-center gap-1.5 min-[400px]:gap-2", className)}>
      <LogoMark />
      <span translate="no" className="font-display text-[0.9375rem] font-bold tracking-tight min-[400px]:text-lg">
        Recomp<span className="text-accent">Achievements</span>
      </span>
    </span>
  );
}
