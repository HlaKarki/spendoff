import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { flushOutbox, onOutboxSynced } from "../lib/outbox";
import { registerServiceWorker } from "../lib/push";
import { invalidateExpenseViews } from "../lib/query-refresh";

export const EXPENSES_SYNCED_MESSAGE = "spendoff:expenses-synced";

/** Client-only: registers the service worker and replays the outbox when back online. */
export function SwRegister() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // A confirmed write may come from logExpense, an online retry, or the initial mount flush.
    // All of them reconcile the same active views through this single subscription.
    const unsubscribe = onOutboxSynced(() => void invalidateExpenseViews(queryClient));

    void registerServiceWorker().then(() => flushOutbox());
    const onOnline = () => void flushOutbox();
    const onServiceWorkerMessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (typeof data === "object" && data !== null && "type" in data && data.type === EXPENSES_SYNCED_MESSAGE) {
        void invalidateExpenseViews(queryClient);
      }
    };

    window.addEventListener("online", onOnline);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    return () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [queryClient]);
  return null;
}
