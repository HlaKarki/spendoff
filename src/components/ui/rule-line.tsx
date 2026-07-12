import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/** The dashed tear line between tape sections. */
export function RuleLine({ className, ...props }: ComponentProps<"hr">) {
  return <hr className={cn("my-3 border-0 border-t border-dashed border-rule", className)} {...props} />;
}
