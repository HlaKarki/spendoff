import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/** Centered mono section label, as printed between tape sections. */
export function TapeLabel({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-center font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-faint", className)}
      {...props}
    />
  );
}
