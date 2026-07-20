import { openDB, type IDBPDatabase } from "idb";
import { track } from "../integrations/posthog";
import { api } from "./api";

const DB_NAME = "spendoff";
const STORE = "outbox";

export interface OutboxItem {
  client_id: string;
  amount_cents: number;
  /**
   * The currency the amount is in. Optional on purpose: an item queued before this field existed
   * has none, and the server reads "no currency" as "the user's base currency" — which is exactly
   * what a v1 client, having no way to log anything else, always meant.
   */
  currency?: string;
  category_id: string;
  note?: string | null;
  spent_at?: string;
  queued_at: string;
}

// v2 adds `currency` to queued items. No migration step is needed — the field is optional and old
// items are already correct without it (see OutboxItem.currency) — but the version bump is still
// required so a browser holding a v1 database opens it rather than failing the version check.
export const DB_VERSION = 2;

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "client_id" });
      },
    });
  }
  return dbp;
}

export async function enqueue(item: OutboxItem): Promise<void> {
  const d = await db();
  await d.put(STORE, item);
}

export async function pending(): Promise<OutboxItem[]> {
  const d = await db();
  return (await d.getAll(STORE)) as OutboxItem[];
}

export async function removeItem(clientId: string): Promise<void> {
  const d = await db();
  await d.delete(STORE, clientId);
}

/**
 * The fields a queued item puts on the wire. `public/sw.js` drains the same store when no tab is
 * open and has to forward the same set — a field it drops doesn't fail loudly, it rewrites the
 * expense (an item queued in EUR arriving with no `currency` is booked at the user's base currency).
 * `sw-outbox.test.ts` reads both files and fails if they disagree, so add a field here and there.
 */
export const SYNC_FIELDS = ["client_id", "amount_cents", "currency", "category_id", "note", "spent_at"] as const;

/** Drain the outbox to the server (idempotent on client_id). Returns how many synced. */
export async function flushOutbox(): Promise<{ synced: number; remaining: number }> {
  const items = await pending();
  if (items.length === 0) return { synced: 0, remaining: 0 };
  try {
    const res = await api.syncExpenses(
      items.map((i) => ({
        client_id: i.client_id,
        amount_cents: i.amount_cents,
        currency: i.currency,
        category_id: i.category_id,
        note: i.note,
        spent_at: i.spent_at,
      })),
    );
    // Drop what the server saved — and, separately, what it says it will never accept.
    //
    // Read defensively: only `client_id` is load-bearing here, and an echo that isn't an array at
    // all must mean "nothing confirmed", not a TypeError. Thrown, it would land in the catch below
    // and be reported as "you're offline" — a permanent sync banner over a server that had in fact
    // saved every row.
    const echoed = Array.isArray(res?.expenses) ? res.expenses : [];
    const confirmed = new Set(echoed.map((e) => e.client_id));

    // `skipped` (HLA-194) is the server telling us why an item is missing from the echo. Only an
    // explicit `retryable: false` drops anything: a server that doesn't send the field, or is
    // unsure, leaves the item queued — "not told" has to keep meaning "keep it", because that's
    // the reading that can't lose an expense.
    //
    // Before this existed, an item the server could never accept (an unknown category) was
    // indistinguishable from one it couldn't price yet, so it rode along on every flush forever
    // and kept re-firing Background Sync behind it (HLA-191).
    const skipped = Array.isArray(res?.skipped) ? res.skipped : [];
    const dropped = skipped.filter((s) => s?.retryable === false);

    for (const i of items) if (confirmed.has(i.client_id)) await removeItem(i.client_id);
    await Promise.all(dropped.map((s) => removeItem(s.client_id)));
    // No UI for this yet — but a silently discarded expense must at least be visible somewhere.
    for (const s of dropped) track("expense_dropped", { reason: s.reason });

    const settled = confirmed.size + dropped.length;
    return { synced: confirmed.size, remaining: items.length - settled };
  } catch {
    return { synced: 0, remaining: items.length };
  }
}

/** Queue an expense and try to sync immediately; also asks the SW for Background Sync. */
export async function logExpense(item: Omit<OutboxItem, "queued_at">): Promise<{ online: boolean }> {
  await enqueue({ ...item, queued_at: new Date().toISOString() });

  // Best-effort Background Sync registration (Chromium); harmless elsewhere.
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && "sync" in reg) {
      await (reg as unknown as { sync: { register: (t: string) => Promise<void> } }).sync.register("sync-expenses");
    }
  } catch {
    /* no-op */
  }

  const res = await flushOutbox();
  const online = res.synced > 0 || res.remaining === 0;
  // Metadata only — never the amount or note; this is analytics, not the ledger.
  track("expense_logged", { category_id: item.category_id, online });
  return { online };
}
