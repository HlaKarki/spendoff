import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-rule bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-faint focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}
