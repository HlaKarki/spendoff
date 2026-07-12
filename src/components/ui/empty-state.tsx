import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** A blank slip is an invitation to act: bold fact, then what to do about it. */
export function EmptyState({
  title,
  children,
  className,
}: {
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-6 text-center", className)}>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children != null && <p className="mt-1 text-sm text-muted">{children}</p>}
    </div>
  );
}
