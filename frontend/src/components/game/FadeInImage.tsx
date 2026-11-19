"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { cx } from "@/lib/cx";

/** A next/image that stays transparent until it has loaded, then fades in over whatever sits
 *  behind it (a Skeleton), so images don't pop in. next/image also reports images that finished
 *  loading before hydration, so a cached image never stays hidden. With reduced motion the fade is
 *  instant (globals.css). shownClassName sets the final opacity (e.g. a dimmed backdrop).
**/
export function FadeInImage({ className, shownClassName = "opacity-100", onLoad, ...props }: ImageProps & { shownClassName?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      {...props}
      alt={props.alt}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
      className={cx("transition-opacity duration-500", loaded ? shownClassName : "opacity-0", className)}
    />
  );
}
