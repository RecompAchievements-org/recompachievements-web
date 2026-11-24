"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FocusEvent, type MouseEvent, type PointerEvent } from "react";
import { useFormStatus } from "react-dom";
import { signOutAction } from "@/app/[lang]/account/settings/actions";
import { ProfilePhoto } from "@/components/profile/ProfilePhoto";
import type { Locale } from "@/i18n/config";
import type { PlayerAvatar } from "@/lib/api/accounts";
import { cx } from "@/lib/cx";
import { MenuIcon, type MenuIconName } from "./MenuIcon";

interface AccountMenuProps {
  username: string;
  avatar: PlayerAvatar | null;
  profileHref: string;
  // Accessible name of the button, already translated ("Your account: name").
  buttonLabel: string;
  menuLabel: string;
  // A separated entry gets a line above it, setting it apart from the regular account options.
  items: { href: string; label: string; icon: MenuIconName; separated?: boolean }[];
  locale: Locale;
  signOutLabel: string;
  signingOutLabel: string;
}

/** The signed-in header button and its menu. A mouse opens it on hover and a click goes to the
 *  profile. Touch has no hover, so the first tap opens it and a second tap goes to the profile. The
 *  keyboard opens it on focus. Escape and an outside press close it.
**/
export function AccountMenu({ username, avatar, profileHref, buttonLabel, menuLabel, items, locale, signOutLabel, signingOutLabel }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const lastPointer = useRef<string | null>(null);
  const skipNextFocus = useRef(false);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: globalThis.PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Returning focus to the button must not open the menu again.
      skipNextFocus.current = document.activeElement !== linkRef.current;
      linkRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onHover(event: PointerEvent, next: boolean) {
    if (event.pointerType === "mouse") setOpen(next);
  }

  function onLinkClick(event: MouseEvent) {
    const touched = lastPointer.current === "touch" || lastPointer.current === "pen";
    lastPointer.current = null;
    if (touched && !open) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    setOpen(false);
  }

  function onLinkFocus(event: FocusEvent<HTMLAnchorElement>) {
    if (skipNextFocus.current) {
      skipNextFocus.current = false;
      return;
    }
    if (event.currentTarget.matches(":focus-visible")) setOpen(true);
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onPointerEnter={(event) => onHover(event, true)}
      onPointerLeave={(event) => onHover(event, false)}
      onBlur={onBlur}
    >
      <Link
        ref={linkRef}
        href={profileHref}
        aria-label={buttonLabel}
        aria-expanded={open}
        aria-controls={menuId}
        onPointerDown={(event) => {
          lastPointer.current = event.pointerType;
        }}
        onClick={onLinkClick}
        onFocus={onLinkFocus}
        className="flex h-9 items-center gap-2 rounded-md px-1.5 text-sm font-medium whitespace-nowrap text-foreground transition-colors hover:bg-surface-raised sm:px-2"
      >
        <ProfilePhoto avatar={avatar} className="size-5 rounded sm:size-6" />
        <span className="hidden max-w-32 truncate md:inline">{username}</span>
        <svg viewBox="0 0 12 12" aria-hidden="true" className={cx("hidden size-3 text-muted md:block", open && "rotate-180")}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </Link>

      {/** The top padding keeps the pointer inside the menu while it moves down from the button. **/}
      <nav id={menuId} aria-label={menuLabel} hidden={!open} className="absolute top-full right-0 z-50 w-56 pt-2">
        <ul className="rounded-lg border border-border-strong bg-surface-raised p-1 shadow-lg">
          {items.map((item) => (
            <li key={item.href} className={item.separated ? "mt-1 border-t border-border pt-1" : undefined}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface"
              >
                <MenuIcon name={item.icon} />
                {item.label}
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-border pt-1">
            <form action={signOutAction}>
              <input type="hidden" name="locale" value={locale} />
              <SignOutButton label={signOutLabel} pendingLabel={signingOutLabel} />
            </form>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function SignOutButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface disabled:opacity-60"
    >
      <MenuIcon name="signOut" />
      {pending ? pendingLabel : label}
    </button>
  );
}
