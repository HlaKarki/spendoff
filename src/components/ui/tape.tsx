import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * The perforated thermal-paper surface — SpendOff's signature. The perforation
 * mask lives in the `.tape` class in styles.css and nowhere else; every paper
 * surface in the app renders through this component.
 */
export function Tape({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("tape px-4 pb-6 pt-4", className)} {...props} />;
}
