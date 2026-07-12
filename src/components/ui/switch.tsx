import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

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
