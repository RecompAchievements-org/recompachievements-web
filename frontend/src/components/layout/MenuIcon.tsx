import type { ReactNode } from "react";

export type MenuIconName = "profile" | "progress" | "messages" | "settings" | "moderation" | "signOut" | "games" | "forum";

const paths: Record<MenuIconName, ReactNode> = {
  profile: (
    <>
      <circle cx="10" cy="6.5" r="3.5" />
      <path d="M3.5 17c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2" />
    </>
  ),
  progress: (
    <>
      <path d="M6 3h8v5a4 4 0 0 1-8 0z" />
      <path d="M6 5H3v1.5A3 3 0 0 0 6 9.5M14 5h3v1.5a3 3 0 0 1-3 3M10 12v3M6.5 17h7M8 15h4" />
    </>
  ),
  messages: (
    <>
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
      <path d="m3 6 7 5 7-5" />
    </>
  ),
  settings: (
    <>
      <path d="M3 6h7M14 6h3M3 14h3M10 14h7" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="8" cy="14" r="2" />
    </>
  ),
  moderation: (
    <>
      <path d="m10 2.5 6 2v5c0 4-2.6 6.6-6 8-3.4-1.4-6-4-6-8v-5z" />
      <path d="m7.3 10 2 2 3.5-4" />
    </>
  ),
  games: (
    <>
      <path d="M6.5 6h7a4 4 0 0 1 3.9 4.9l-.8 3.5a2 2 0 0 1-3.4.9L11.5 13.5h-3l-1.7 1.8a2 2 0 0 1-3.4-.9l-.8-3.5A4 4 0 0 1 6.5 6z" />
      <path d="M6.5 9v2.5M5.25 10.25h2.5" />
      <circle cx="13" cy="9.5" r=".6" fill="currentColor" />
      <circle cx="14.5" cy="11" r=".6" fill="currentColor" />
    </>
  ),
  forum: (
    <>
      <path d="M3.5 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H9l-3.5 3v-3a2 2 0 0 1-2-2z" />
      <path d="M7 7h6M7 10h4" />
    </>
  ),
  signOut: (
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" />
      <path d="M12.5 6.5 16 10l-3.5 3.5M16 10H8" />
    </>
  ),
};

// Decorative: each menu entry always shows its text next to the icon.
export function MenuIcon({ name }: { name: MenuIconName }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0 text-muted">
      {paths[name]}
    </svg>
  );
}
