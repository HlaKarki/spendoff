import type { QueryClient } from "@tanstack/react-query";

/**
 * Dynamic server state must be reconsidered whenever the user returns to this window. A phone can
 * have changed the same account while this tab was in the background, so the usual "only if stale"
 * focus policy is too weak for cross-device continuity.
 */
export const SERVER_QUERY_REFRESH = {
  refetchOnWindowFocus: "always",
  refetchOnReconnect: "always",
} as const;

/**
 * Poll only views where a newly logged expense is expected to appear promptly. TanStack Query only
 * runs an interval for an observed query; `refetchIntervalInBackground: false` stops it in hidden
 * tabs, and its default `online` network mode pauses requests while the browser is offline.
 */
export const LIVE_SERVER_QUERY_REFRESH = {
  ...SERVER_QUERY_REFRESH,
  refetchInterval: 15_000,
  refetchIntervalInBackground: false,
} as const;

/**
 * One confirmed expense changes the ledger, personal analytics, and every battle standing that
 * includes its owner. Invalidation marks inactive views stale and immediately refetches active ones.
 */
export function invalidateExpenseViews(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    queryClient.invalidateQueries({ queryKey: ["analytics"] }),
    queryClient.invalidateQueries({ queryKey: ["standings"] }),
  ]).then(() => undefined);
}
