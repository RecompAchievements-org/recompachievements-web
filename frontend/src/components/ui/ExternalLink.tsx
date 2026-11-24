import type { ComponentProps } from "react";
import { getMessages } from "@/i18n/server";
import { newTabProps } from "./newTab";

// Screen-reader hint appended to every link that opens a new tab.
export async function NewTabHint() {
  const { common } = await getMessages();
  return <span className="sr-only"> {common.opensInNewTab}</span>;
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
