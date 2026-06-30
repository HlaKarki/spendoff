import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import type { Expense } from "./types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const { user } = await api.me();
        return user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.categories()).categories,
    staleTime: Infinity,
  });
}

export function useBattles() {
  return useQuery({
    queryKey: ["battles"],
    queryFn: async () => (await api.listBattles()).battles,
  });
}

export function useBattle(id: string) {
  return useQuery({
    queryKey: ["battle", id],
    queryFn: () => api.getBattle(id),
    enabled: !!id,
  });
}

export function useStandings(id: string, yearMonth?: string) {
  return useQuery({
    queryKey: ["standings", id, yearMonth ?? "current"],
    queryFn: () => api.standings(id, yearMonth),
    enabled: !!id,
  });
}

export function useResults(id: string) {
  return useQuery({
    queryKey: ["results", id],
    queryFn: async () => (await api.listResults(id)).results,
    enabled: !!id,
  });
}

export function useResult(id: string, yearMonth: string) {
  return useQuery({
    queryKey: ["result", id, yearMonth],
    queryFn: async () => (await api.getResult(id, yearMonth)).result,
    enabled: !!id && !!yearMonth,
  });
}

// Fetches every page for the month so the day view can group/switch client-side.
export function useExpenses(params?: { year_month?: string }) {
  return useQuery({
    queryKey: ["expenses", params?.year_month ?? "all"],
    queryFn: async () => {
      const all: Expense[] = [];
      let cursor: string | undefined;
      do {
        // oxlint-disable-next-line no-await-in-loop -- cursor pagination is inherently sequential
        const page = await api.listExpenses({ ...params, cursor, limit: 100 });
        all.push(...page.expenses);
        cursor = page.next_cursor ?? undefined;
      } while (cursor);
      return all;
    },
  });
}
