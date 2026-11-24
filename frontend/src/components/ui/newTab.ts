// Props that open a link in a new tab without giving the new page access to this one.
// Kept apart from ExternalLink so client components (such as the forum preview) can use them.
export const newTabProps = { target: "_blank", rel: "noopener noreferrer" } as const;
