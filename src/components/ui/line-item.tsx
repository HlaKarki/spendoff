import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * One printed line on a tape: what happened, when (register meta), how much.
 * `amount` is usually a <Money>. Style-only — knows nothing about Expense.
 */
export function LineItem({
  what,
  meta,
  amount,
  className,
}: {
  what: ReactNode;
  meta?: ReactNode;
  amount: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1", className)}>
      <span className="min-w-0 text-sm font-medium text-ink">
        {what}
        {meta != null && (
          <small className="block font-mono text-[10px] uppercase tracking-wide text-faint">{meta}</small>
        )}
      </span>
      <span className="shrink-0 text-sm">{amount}</span>
    </div>
  );
}
