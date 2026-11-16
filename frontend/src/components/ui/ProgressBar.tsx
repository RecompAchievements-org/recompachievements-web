import { cx } from "@/lib/cx";

type ProgressTone = "accent" | "gold" | "success";

const toneClasses: Record<ProgressTone, string> = {
  accent: "bg-accent",
  gold: "bg-gold",
  success: "bg-success",
};

interface ProgressBarProps {
  /** Progress from 0 to 100; values outside the range are clamped. **/
  value: number;
  /** Accessible name, e.g. "Completion". **/
  label: string;
  tone?: ProgressTone;
  className?: string;
}

export function ProgressBar({ value, label, tone = "accent", className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cx("h-2 w-full overflow-hidden rounded-full bg-surface-raised", className)}
    >
      <div
        className={cx("h-full rounded-full transition-[width]", toneClasses[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
