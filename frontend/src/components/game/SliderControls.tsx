"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { GameBackdrop } from "./GameBackdrop";

export interface SliderLabels {
  carousel: string;
  pause: string;
  play: string;
  previous: string;
  next: string;
}

export interface SlideRailItem {
  title: string;
  subtitle: string;
  slideLabel: string;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Interactive part of the featured slider. Every slide arrives server-rendered; this only picks
 *  which one is visible. Auto-advance follows the active progress bar's animation, pauses on hover
 *  and keyboard focus, has a pause button (WCAG 2.2.2), and is off when the visitor prefers
 *  reduced motion. Arrow keys and horizontal swipes change slides. The visible slide's background
 *  art sets the page backdrop (GameBackdrop), crossfading on every change; a slide's backdrop is
 *  only loaded the first time that slide shows.
**/
export function SliderControls({
  slides,
  rail,
  labels,
  backdrops,
}: {
  slides: ReactNode[];
  rail: SlideRailItem[];
  labels: SliderLabels;
  // Each slide's background art URL (null when it has none), for the page backdrop.
  backdrops: (string | null)[];
}) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false);
  const swipeStart = useRef<number | null>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );

  const count = slides.length;
  const canAutoPlay = count > 1 && !reducedMotion;
  const autoPlaying = canAutoPlay && playing;
  const go = (next: number) => {
    const target = (next + count) % count;
    setIndex(target);
    setShown((seen) => (seen.has(target) ? seen : new Set(seen).add(target)));
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.carousel}
      className="flex flex-col gap-3"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(index + 1);
        if (event.key === "ArrowLeft") go(index - 1);
      }}
    >
      <GameBackdrop
        images={backdrops.map((url, slide) => (shown.has(slide) ? url : null))}
        active={index}
        className="h-[34rem] sm:h-[46rem]"
      />
      <div
        aria-live={autoPlaying ? "off" : "polite"}
        className="relative grid overflow-hidden rounded-2xl border border-border bg-surface"
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") swipeStart.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (swipeStart.current === null) return;
          const distance = event.clientX - swipeStart.current;
          swipeStart.current = null;
          if (Math.abs(distance) > 50) go(index + (distance < 0 ? 1 : -1));
        }}
      >
        {/** All slides share one grid cell, so the slider is always as tall as its tallest slide
         *  and doesn't jump between slides. Inactive ones keep their space but are invisible,
         *  not focusable, and hidden from screen readers.
        **/}
        {slides.map((slide, slideIndex) => {
          const active = slideIndex === index;
          return (
            <div
              key={rail[slideIndex].title}
              role="group"
              aria-roledescription="slide"
              aria-label={rail[slideIndex].slideLabel}
              aria-hidden={!active}
              inert={!active}
              className={cx("col-start-1 row-start-1", !active && "invisible")}
            >
              {slide}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <ol className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          {rail.map((item, itemIndex) => {
            const active = itemIndex === index;
            return (
              <li key={item.title} className="min-w-40 flex-1">
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  aria-label={`${item.title} (${item.slideLabel})`}
                  onClick={() => go(itemIndex)}
                  className={cx(
                    "flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors",
                    active ? "border-accent/60 bg-surface-raised" : "border-border bg-surface hover:border-border-strong",
                  )}
                >
                  <span translate="no" className="truncate text-sm font-semibold">{item.title}</span>
                  <span className="truncate text-xs text-muted">{item.subtitle}</span>
                  <span aria-hidden="true" className="mt-1 h-0.5 overflow-hidden rounded-full bg-border">
                    {active && (
                      <span
                        key={index}
                        className={cx("block h-full origin-left bg-accent", autoPlaying && "animate-slide-progress")}
                        style={autoPlaying ? { animationPlayState: held ? "paused" : "running" } : undefined}
                        onAnimationEnd={() => go(index + 1)}
                      />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {count > 1 && (
          <div className="flex shrink-0 gap-1">
            <ControlButton label={labels.previous} onClick={() => go(index - 1)}>
              <path d="M12.5 5 7.5 10l5 5" />
            </ControlButton>
            {canAutoPlay && (
              <ControlButton label={playing ? labels.pause : labels.play} onClick={() => setPlaying((value) => !value)}>
                {playing ? <path d="M7.5 5v10M12.5 5v10" /> : <path d="M7 5l8 5-8 5z" />}
              </ControlButton>
            )}
            <ControlButton label={labels.next} onClick={() => go(index + 1)}>
              <path d="M7.5 5l5 5-5 5" />
            </ControlButton>
          </div>
        )}
      </div>
    </section>
  );
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-10 place-items-center rounded-lg border border-border bg-surface text-muted transition-colors hover:border-border-strong hover:text-foreground"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
