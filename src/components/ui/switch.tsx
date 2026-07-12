import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * The switch face alone, for rows that are themselves the button (a whole-row
 * toggle announces its text; this just shows its state). aria-hidden on
 * purpose — the wrapping control carries the semantics.
 */
export function SwitchIndicator({ on, className }: { on: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-flex shrink-0 items-center", className)}>
      <span className={cn("h-[22px] w-9 rounded-full transition", on ? "bg-accent" : "bg-line")} />
      <span
        className={cn(
          "pointer-events-none absolute left-[3px] size-4 rounded-full bg-paper shadow transition",
          on && "translate-x-[14px]",
        )}
      />
    </span>
  );
}

/**
 * Toggle built on a native checkbox so keyboard, form, and screen-reader
 * semantics come for free; only the rendering is custom.
 */
export function Switch({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <label className={cn("relative inline-flex shrink-0 cursor-pointer items-center", className)}>
      <input type="checkbox" role="switch" className="peer sr-only" {...props} />
      <span className="h-[22px] w-9 rounded-full bg-line transition peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-45" />
      <span className="pointer-events-none absolute left-[3px] size-4 rounded-full bg-paper shadow transition peer-checked:translate-x-[14px]" />
    </label>
  );
}
