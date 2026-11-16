import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx("rounded-xl border border-border bg-surface p-5", className)}
      {...props}
    />
  );
}
