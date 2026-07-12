import { openDB, type IDBPDatabase } from "idb";
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
const DB_VERSION = 2;

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
    // Drop only what the server confirmed it saved. It may skip items it can't accept (e.g. an
    // unknown category) or can't yet price (a foreign currency while the rate feed is behind) and
    // echo back the rest; removing an unconfirmed item would lose it silently. A skipped item stays
    // queued and rides along on the next flush.
    const confirmed = new Set(res.expenses.map((e) => e.client_id));
    for (const i of items) if (confirmed.has(i.client_id)) await removeItem(i.client_id);
    return { synced: confirmed.size, remaining: items.length - confirmed.size };
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
  return { online: res.synced > 0 || res.remaining === 0 };
}
