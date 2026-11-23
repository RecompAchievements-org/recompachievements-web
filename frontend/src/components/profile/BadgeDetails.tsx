"use client";

import { useRef, type FocusEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/Badge";
import { useFloatingPanel } from "@/components/ui/useFloatingPanel";
import { BadgeIcon } from "./BadgeIcon";
import type { BadgeDetailsData } from "./badgeDetailsData";

/** A badge that shows its details in a small panel: on mouse hover, on tap (tap again or elsewhere
 *  to close), and on keyboard focus (Escape closes). The panel is drawn on the page body, so no
 *  card can clip it. Screen readers get the same details from the button's name.
**/
export function BadgeDetails({ details, className, children }: { details: BadgeDetailsData; className?: string; children: ReactNode }) {
  const { open, setOpen, triggerRef, panelRef, onHoverStart, onHoverEnd } = useFloatingPanel<HTMLButtonElement>();
  const lastPointer = useRef<string | null>(null);

  function onClick() {
    const pointer = lastPointer.current;
    lastPointer.current = null;
    // A mouse already opened it on hover; touch and the keyboard toggle it.
    if (pointer !== "mouse") setOpen((value) => !value);
  }

  function onFocus(event: FocusEvent<HTMLButtonElement>) {
    if (event.currentTarget.matches(":focus-visible")) setOpen(true);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-label={`${details.name}. ${details.kindLabel}, ${details.rarityLabel}. ${details.description} ${details.unlockedLabel}.`}
        onPointerDown={(event) => {
          lastPointer.current = event.pointerType;
        }}
        onPointerEnter={onHoverStart}
        onPointerLeave={onHoverEnd}
        onClick={onClick}
        onFocus={onFocus}
        onBlur={() => setOpen(false)}
        className={className}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            aria-hidden="true"
            onPointerEnter={onHoverStart}
            onPointerLeave={onHoverEnd}
            style={{ visibility: "hidden" }}
            className="fixed top-0 left-0 z-50 flex w-64 max-w-[calc(100vw-1rem)] flex-col gap-3 rounded-xl border border-border-strong bg-surface-raised p-4 text-left shadow-lg"
          >
            <div className="flex items-center gap-3">
              <BadgeIcon kind={details.kind} rarity={details.rarity} className="h-auto w-10" />
              <div className="flex min-w-0 flex-col">
                <p className="font-display leading-tight font-semibold wrap-anywhere text-foreground">{details.name}</p>
                <p className="text-xs text-muted">{details.kindLabel}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted">{details.description}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <Badge tone={details.rarity}>{details.rarityLabel}</Badge>
              <span className="text-xs text-subtle">{details.unlockedLabel}</span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
