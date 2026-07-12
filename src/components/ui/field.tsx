import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** Label-above-control form pattern. The label is register output (mono caps). */
export function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-faint"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
