"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";

const hoverCloseDelayMs = 120;
const viewportMargin = 8;
const triggerGap = 8;

/** Opens and places a panel drawn on the page body next to its trigger. It opens on mouse hover
 *  (after openDelayMs), stays inside the screen, and closes on Escape, on an outside press, or
 *  when the trigger scrolls away. Touch and keyboard handling stay with each component.
**/
export function useFloatingPanel<Trigger extends HTMLElement>(openDelayMs = 0) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<Trigger>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }

  useEffect(() => cancelHover, []);

  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const { width, height } = panel.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const centered = trigger.left + trigger.width / 2 - width / 2;
      const left = Math.max(viewportMargin, Math.min(centered, viewportWidth - width - viewportMargin));
      const below = trigger.bottom + triggerGap;
      const fitsBelow = below + height <= window.innerHeight - viewportMargin;
      const top = fitsBelow ? below : Math.max(viewportMargin, trigger.top - triggerGap - height);
      panel.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      panel.style.visibility = "visible";
    }

    function onMove() {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (trigger && (trigger.bottom < 0 || trigger.top > window.innerHeight)) setOpen(false);
      else place();
    }
    function onPointerDown(event: globalThis.PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    place();
    const observer = new ResizeObserver(place);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onHoverStart(event: PointerEvent) {
    if (event.pointerType !== "mouse") return;
    cancelHover();
    if (openDelayMs === 0) setOpen(true);
    else hoverTimer.current = setTimeout(() => setOpen(true), openDelayMs);
  }

  function onHoverEnd(event: PointerEvent) {
    if (event.pointerType !== "mouse") return;
    cancelHover();
    hoverTimer.current = setTimeout(() => setOpen(false), hoverCloseDelayMs);
  }

  return { open, setOpen, triggerRef, panelRef, onHoverStart, onHoverEnd };
}
