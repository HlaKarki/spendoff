import type { QueryClient } from "@tanstack/react-query";
import { track } from "../integrations/posthog";
import { api } from "./api";
import { browserCurrency, browserTimezone } from "./format";
import type { User } from "./types";

/** Create a guest account and seed it into the cache. "/" sees `me` resolve and swaps to the app itself. */
export async function startGuest(qc: QueryClient): Promise<void> {
  const { user } = await api.startGuest({ timezone: browserTimezone(), base_currency: browserCurrency() });
  qc.setQueryData(["me"], user);
  track("guest_started", {});
}

export function formatGuestExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** A merge rewrites the ledger under the new identity, so every cached query is stale after sign-in. */
export function refreshAfterAuth(qc: QueryClient, user: User): void {
  qc.setQueryData(["me"], user);
  void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
}
