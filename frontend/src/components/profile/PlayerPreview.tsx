"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { createPortal } from "react-dom";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFloatingPanel } from "@/components/ui/useFloatingPanel";
import type { PlayerAvatar, StaffRole } from "@/lib/api/accounts";
import type { RarityTier } from "@/lib/api/games";
import { BadgeIcon } from "./BadgeIcon";
import { ProfilePhoto } from "./ProfilePhoto";
import { StaffTag } from "./StaffRole";
import type { BadgeKind } from "./sampleBadges";

const hoverOpenDelayMs = 200;

export interface PlayerPreviewData {
  username: string;
  memberSince: string;
  lastActive: string;
  avatar: PlayerAvatar | null;
  // A staff role; null for players.
  role: StaffRole | null;
  // Up to three featured badges.
  badges: { id: string; kind: BadgeKind; rarity: RarityTier; name: string; rarityLabel: string }[];
}

export interface PlayerPreviewLabels {
  open: string;
  view: string;
  loading: string;
  unavailable: string;
  memberSince: string;
  lastActivity: string;
}

/** A player's photo that links to their profile and previews it. The preview opens on mouse hover
 *  or keyboard focus; on touch screens the first tap opens it and a second tap follows the link.
 *  Its data loads only when opened, so a page of comments makes no extra requests.
**/
export function PlayerPreview({
  username,
  avatar,
  href,
  labels,
  load,
  className,
}: {
  username: string;
  avatar: PlayerAvatar | null;
  href: string;
  labels: PlayerPreviewLabels;
  load: (username: string) => Promise<PlayerPreviewData | null>;
  className?: string;
}) {
  const { open, setOpen, triggerRef, panelRef, onHoverStart, onHoverEnd } = useFloatingPanel<HTMLAnchorElement>(hoverOpenDelayMs);
  const [preview, setPreview] = useState<PlayerPreviewData | "failed" | null>(null);
  const requested = useRef(false);
  const lastPointer = useRef<string | null>(null);

  useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    load(username)
      .catch(() => null)
      .then((data) => {
        // A failed load can be tried again the next time the preview opens.
        requested.current = data !== null;
        setPreview(data ?? "failed");
      });
  }, [open, username, load]);

  function onFocus(event: FocusEvent<HTMLAnchorElement>) {
    if (event.currentTarget.matches(":focus-visible")) setOpen(true);
  }

  return (
    <>
      <Link
        ref={triggerRef}
        href={href}
        aria-label={labels.open}
        onPointerDown={(event) => {
          lastPointer.current = event.pointerType;
        }}
        onPointerEnter={onHoverStart}
        onPointerLeave={onHoverEnd}
        onClick={(event) => {
          const pointer = lastPointer.current;
          lastPointer.current = null;
          if (pointer === "touch" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onFocus={onFocus}
        onBlur={() => setOpen(false)}
        className={className}
      >
        <ProfilePhoto avatar={avatar} className="block size-full rounded-lg" />
      </Link>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            aria-hidden="true"
            onPointerEnter={onHoverStart}
            onPointerLeave={onHoverEnd}
            onMouseDown={(event) => event.preventDefault()}
            style={{ visibility: "hidden" }}
            className="fixed top-0 left-0 z-50 flex w-64 max-w-[calc(100vw-1rem)] flex-col gap-3 rounded-xl border border-border-strong bg-surface-raised p-4 text-left shadow-lg"
          >
            <div className="flex items-center gap-3">
              <ProfilePhoto avatar={avatar} className="size-12 rounded-lg border border-border" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-display font-semibold wrap-anywhere text-foreground">{username}</p>
                {preview && preview !== "failed" && preview.role && <StaffTag role={preview.role} />}
              </div>
            </div>
            {preview !== "failed" && (preview === null || preview.badges.length > 0) && (
              <section className="border-y border-border py-2.5">
                <ul className="flex flex-col gap-1">
                  {preview === null
                    ? [0, 1, 2].map((row) => <Skeleton key={row} className="h-7 w-full rounded-md" />)
                    : preview.badges.map((badge) => (
                        <li key={badge.id} className="flex h-7 items-center gap-2">
                          <BadgeIcon kind={badge.kind} rarity={badge.rarity} className="h-6 w-auto" />
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{badge.name}</span>
                          <span className="shrink-0 text-xs text-subtle">{badge.rarityLabel}</span>
                        </li>
                      ))}
                </ul>
              </section>
            )}
            {preview === null || preview === "failed" ? (
              <p className="flex min-h-11 items-center text-sm text-muted">{preview === "failed" ? labels.unavailable : labels.loading}</p>
            ) : (
              <dl className="flex min-h-11 flex-col justify-center gap-1 text-sm">
                <PreviewStat label={labels.memberSince} value={preview.memberSince} />
                <PreviewStat label={labels.lastActivity} value={preview.lastActive} />
              </dl>
            )}
            <Link href={href} tabIndex={-1} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border-strong px-3 text-sm font-semibold text-foreground transition-colors hover:border-accent">
              {labels.view}
            </Link>
          </div>,
          document.body,
        )}
    </>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}
