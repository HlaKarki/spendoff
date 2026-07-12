import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * The rubber-stamp verdict ("SETTLED", a winner's name). With `thunk` it plays
 * the app's second and last sanctioned animation — the keyframes live in
 * styles.css behind a prefers-reduced-motion guard.
 */
export function Stamp({ thunk, className, ...props }: ComponentProps<"span"> & { thunk?: boolean }) {
  return (
    <span
      className={cn(
        "inline-block -rotate-[7deg] rounded border-2 border-stamp px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stamp opacity-85",
        "[mask-image:radial-gradient(circle_at_30%_40%,#000_60%,rgb(0_0_0/0.55))]",
        thunk && "stamp-thunk",
        className,
      )}
      {...props}
    />
  );
}
