import { focusManager, QueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/api";

// TanStack Query's browser default follows `visibilitychange`, which covers switching tabs but not
// every desktop window-focus transition. Listen to both and coalesce the pair browsers commonly
// emit together so returning from the native app prompts exactly one reconciliation pass.
if (typeof window !== "undefined") {
  focusManager.setEventListener((onFocus) => {
    let lastEventAt = Number.NEGATIVE_INFINITY;
    const listener = () => {
      const now = performance.now();
      if (now - lastEventAt < 100) return;
      lastEventAt = now;
      onFocus();
    };

    window.addEventListener("visibilitychange", listener, false);
    window.addEventListener("focus", listener, false);
    return () => {
      window.removeEventListener("visibilitychange", listener);
      window.removeEventListener("focus", listener);
    };
  });
}

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // A 4xx is the server's considered answer, not a blip — asking twice more changes nothing
        // and just delays the error the UI is waiting to show. Retry only what might actually
        // differ next time: 5xx, and network failures (no ApiError at all). `useDayExpenses` is
        // the case that made this matter — its queryFn walks the whole cursor pagination, so a
        // failure on page 4 re-ran pages 1-4 three more times.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 3;
        },
      },
    },
  });

  return {
    queryClient,
  };
}
export default function TanstackQueryProvider() {}
