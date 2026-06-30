import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "./api";

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

export function useExpenses(params?: { year_month?: string }) {
  return useInfiniteQuery({
    queryKey: ["expenses", params?.year_month ?? "all"],
    queryFn: ({ pageParam }) => api.listExpenses({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}
