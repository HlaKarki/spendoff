import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/** Selectable pill (categories, options). Selection is expressed via aria-pressed. */
export function Chip({
  pressed,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { pressed: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
        pressed ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-ink hover:bg-paper-2",
        className,
      )}
      {...props}
    />
  );
}
