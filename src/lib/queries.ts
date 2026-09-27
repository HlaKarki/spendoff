import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { LIVE_SERVER_QUERY_REFRESH, SERVER_QUERY_REFRESH } from "./query-refresh";
import type { Expense } from "./types";

/* The session cookie is httpOnly, so the client can't know "probably signed in"
 * before `useMe` resolves. This hint is that pre-paint signal: set once a session
 * is confirmed, cleared on sign-out or a dead session. It only picks which shell
 * "/" renders first — AppShell still verifies the real session. */
export const AUTH_HINT_KEY = "spendoff-authed";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const { user } = await api.me();
        return user;
      } catch (e) {
        // `null` means "no session" and is what AppShell turns into the redirect to /onboard.
        // Anything else rethrows and leaves the app on the splash screen, so accept 403 alongside
        // 401: on THIS endpoint the two can only mean the same thing, and pinning it to exactly
        // 401 makes a hung app the failure mode if the gate's status ever shifts.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 30_000,
    ...SERVER_QUERY_REFRESH,
  });
}

/**
 * The account's timezone, or undefined while `useMe` is still in flight. Pass straight to the
 * date helpers in `format.ts` — they fall back to the device zone until this resolves.
 */
export function useTimezone(): string | undefined {
  return useMe().data?.timezone;
}

/**
 * The account's base currency, or undefined while `useMe` is still in flight. Pass straight to
 * `money()` — it falls back to USD until this resolves. This is the currency of the user's OWN
 * totals; anything battle-scoped must use that battle's currency instead.
 */
export function useBaseCurrency(): string | undefined {
  return useMe().data?.base_currency;
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.categories()).categories,
    staleTime: Infinity,
  });
}

/** The currencies the server can price. Static for a session — the set only changes on deploy. */
export function useCurrencies() {
  return useQuery({
    queryKey: ["currencies"],
    queryFn: async () => (await api.currencies()).currencies,
    staleTime: Infinity,
  });
}

export function useBattles() {
  return useQuery({
    queryKey: ["battles"],
    queryFn: async () => (await api.listBattles()).battles,
    ...SERVER_QUERY_REFRESH,
  });
}

export function useBattle(id: string) {
  return useQuery({
    queryKey: ["battle", id],
    queryFn: () => api.getBattle(id),
    enabled: !!id,
    ...SERVER_QUERY_REFRESH,
  });
}

export function useStandings(id: string, yearMonth?: string) {
  return useQuery({
    queryKey: ["standings", id, yearMonth ?? "current"],
    queryFn: () => api.standings(id, yearMonth),
    enabled: !!id,
    ...LIVE_SERVER_QUERY_REFRESH,
  });
}

/**
 * Another member's log for one month. Deliberately never cached beyond the screen that's showing it:
 * the owner can revoke sharing at any moment, and a stale copy sitting in the cache would keep
 * rendering a log they've since made private. `gcTime: 0` drops it the moment the view unmounts, and
 * a zero stale time means every visit re-asks the server — which is the only thing that knows.
 */
export function useMemberHistory(id: string, userId: string, yearMonth: string) {
  return useQuery({
    queryKey: ["member-history", id, userId, yearMonth],
    queryFn: () => api.memberHistory(id, userId, yearMonth),
    enabled: !!id && !!userId && !!yearMonth,
    staleTime: 0,
    gcTime: 0,
    ...LIVE_SERVER_QUERY_REFRESH,
  });
}

export function useResults(id: string) {
  return useQuery({
    queryKey: ["results", id],
    queryFn: async () => (await api.listResults(id)).results,
    enabled: !!id,
    ...SERVER_QUERY_REFRESH,
  });
}

export function useResult(id: string, yearMonth: string) {
  return useQuery({
    queryKey: ["result", id, yearMonth],
    queryFn: async () => (await api.getResult(id, yearMonth)).result,
    enabled: !!id && !!yearMonth,
    ...SERVER_QUERY_REFRESH,
  });
}

export function useAnalytics(params?: { year_month?: string; months?: number }) {
  return useQuery({
    queryKey: ["analytics", params?.year_month ?? "current", params?.months ?? 6],
    queryFn: () => api.analytics(params),
    ...LIVE_SERVER_QUERY_REFRESH,
  });
}

export function useRecurring() {
  return useQuery({
    queryKey: ["recurring"],
    queryFn: async () => (await api.listRecurring()).recurring,
    ...SERVER_QUERY_REFRESH,
  });
}

// Fetches just one calendar day's rows (server resolves the day in the user's tz).
// Keyed under ["expenses", …] so expense mutations invalidate it via the ["expenses"] prefix.
export function useDayExpenses(day: string | null, categoryId?: string) {
  return useQuery({
    queryKey: ["expenses", "day", day ?? "none", categoryId ?? "all"],
    enabled: !!day,
    placeholderData: keepPreviousData,
    ...LIVE_SERVER_QUERY_REFRESH,
    queryFn: async () => {
      const all: Expense[] = [];
      let cursor: string | undefined;
      do {
        // oxlint-disable-next-line no-await-in-loop -- cursor pagination is inherently sequential
        const page = await api.listExpenses({ day: day!, category_id: categoryId, cursor, limit: 100 });
        all.push(...page.expenses);
        cursor = page.next_cursor ?? undefined;
      } while (cursor);
      return all;
    },
  });
}
