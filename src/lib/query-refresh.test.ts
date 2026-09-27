import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import { invalidateExpenseViews, LIVE_SERVER_QUERY_REFRESH, SERVER_QUERY_REFRESH } from "./query-refresh";

describe("cross-device query refresh policy", () => {
  test("always reconciles dynamic server state after focus or reconnect", () => {
    expect(SERVER_QUERY_REFRESH).toEqual({
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
    });
  });

  test("polls live views conservatively and never in a background tab", () => {
    expect(LIVE_SERVER_QUERY_REFRESH).toMatchObject({
      refetchInterval: 15_000,
      refetchIntervalInBackground: false,
    });
  });

  test("a confirmed expense invalidates every derived query family", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    await invalidateExpenseViews(queryClient);

    expect(invalidateQueries.mock.calls.map(([filters]) => filters.queryKey)).toEqual([
      ["expenses"],
      ["analytics"],
      ["standings"],
    ]);
  });
});
