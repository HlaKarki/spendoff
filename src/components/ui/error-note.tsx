import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** Failure with direction: what went wrong, why it's safe, what to do next. */
export function ErrorNote({
  title,
  children,
  onRetry,
  retryLabel = "Retry now",
  className,
}: {
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("border-l-[3px] border-stamp py-1 pl-3", className)}>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-sm text-muted">
        {children}
        {onRetry && (
          <>
            {" "}
            <button type="button" onClick={onRetry} className="font-semibold text-accent">
              {retryLabel}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
