import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/api";

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
