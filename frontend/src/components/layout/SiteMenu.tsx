"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { PlatformIcon } from "@/components/auth/PlatformIcon";
import { newTabProps } from "@/components/ui/newTab";
import { MenuIcon } from "./MenuIcon";

const itemClasses = "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface";

/** The site's main links (Games, Forum, GitHub) behind a menu button, for screens too narrow to
 *  show them in the header row. A tap or click opens it; Escape, an outside press, or choosing a
 *  link closes it.
**/
export function SiteMenu({
  label,
  games,
  forum,
  github,
  gamesHref,
  forumHref,
  githubHref,
  newTabLabel,
}: {
  label: string;
  games: string;
  forum: string;
  github: string;
  gamesHref: string;
  forumHref: string;
  githubHref: string;
  // Screen-reader hint for the GitHub link, which opens in a new tab.
  newTabLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative" onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className="flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-5">
          {open ? <path d="m5 5 10 10M15 5 5 15" /> : <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />}
        </svg>
      </button>

      <nav id={menuId} aria-label={label} hidden={!open} className="absolute top-full right-0 z-50 w-56 pt-2">
        <ul className="rounded-lg border border-border-strong bg-surface-raised p-1 shadow-lg">
          <li>
            <Link href={gamesHref} onClick={close} className={itemClasses}>
              <MenuIcon name="games" />
              {games}
            </Link>
          </li>
          <li>
            <Link href={forumHref} onClick={close} className={itemClasses}>
              <MenuIcon name="forum" />
              {forum}
            </Link>
          </li>
          <li className="mt-1 border-t border-border pt-1">
            <a href={githubHref} {...newTabProps} onClick={close} className={itemClasses}>
              <PlatformIcon platform="github" className="text-muted" />
              <span translate="no">{github}</span>
              <span className="sr-only"> {newTabLabel}</span>
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
