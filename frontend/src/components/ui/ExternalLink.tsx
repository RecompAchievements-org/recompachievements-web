import type { ComponentProps } from "react";

// Props that open a link in a new tab without giving the new page access to this one.
export const newTabProps = { target: "_blank", rel: "noopener noreferrer" } as const;

// Screen-reader hint appended to every link that opens a new tab.
export function NewTabHint() {
  return <span className="sr-only"> (opens in a new tab)</span>;
}

// A link to another site that opens in a new tab.
export function ExternalLink({ children, ...props }: Omit<ComponentProps<"a">, "target" | "rel">) {
  return (
    <a {...newTabProps} {...props}>
      {children}
      <NewTabHint />
    </a>
  );
}
