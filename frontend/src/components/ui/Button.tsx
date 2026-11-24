import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";
import { NewTabHint } from "./ExternalLink";
import { newTabProps } from "./newTab";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-strong",
  secondary: "border border-border-strong bg-surface-raised text-foreground hover:border-accent",
  ghost: "text-muted hover:bg-surface-raised hover:text-foreground",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-11 px-5 text-base",
};

function buttonClasses({ variant = "primary", size = "md" }: ButtonStyleProps, className?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonStyleProps & ComponentProps<"button">) {
  return <button type={type} className={buttonClasses({ variant, size }, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  external = false,
  children,
  ...props
}: ButtonStyleProps & { external?: boolean } & ComponentProps<typeof Link>) {
  return (
    <Link
      className={buttonClasses({ variant, size }, className)}
      {...(external ? newTabProps : {})}
      {...props}
    >
      {children}
      {external && <NewTabHint />}
    </Link>
  );
}
