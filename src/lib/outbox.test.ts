import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Expense } from "./types";

// The outbox talks to the server only through api.syncExpenses; everything else is IndexedDB.
// Delegate to a mutable spy so each test decides how the "server" responds.
const syncExpenses = vi.fn();
vi.mock("./api", () => ({ api: { syncExpenses: (...args: unknown[]) => syncExpenses(...args) } }));

type Outbox = typeof import("./outbox");
let outbox: Outbox;

// A saved-expense row as the server echoes it back — only client_id matters to the outbox.
const saved = (client_id: string): Expense =>
  ({ id: crypto.randomUUID(), client_id, amount_cents: 0, category_id: "c", note: null }) as unknown as Expense;

const item = (client_id: string, amount_cents = 100) => ({ client_id, amount_cents, category_id: "food" });

beforeEach(async () => {
  // A brand-new IndexedDB per test, and a fresh module so its cached connection re-opens against it.
  globalThis.indexedDB = new IDBFactory();
  syncExpenses.mockReset();
  vi.resetModules();
  outbox = await import("./outbox");
});

describe("enqueue / pending / removeItem", () => {
  test("an enqueued item is pending", async () => {
    await outbox.enqueue({ ...item("a"), queued_at: "2026-07-01T00:00:00Z" });
    const p = await outbox.pending();
    expect(p.map((i) => i.client_id)).toEqual(["a"]);
  });

  test("enqueuing the same client_id twice keeps ONE row — the queue can't double an expense", async () => {
    await outbox.enqueue({ ...item("a", 100), queued_at: "2026-07-01T00:00:00Z" });
    await outbox.enqueue({ ...item("a", 250), queued_at: "2026-07-01T00:00:01Z" });
    const p = await outbox.pending();
    expect(p).toHaveLength(1);
    expect(p[0].amount_cents).toBe(250); // last write wins on the same key
  });

  test("removeItem deletes only its own key", async () => {
    await outbox.enqueue({ ...item("a"), queued_at: "t" });
    await outbox.enqueue({ ...item("b"), queued_at: "t" });
    await outbox.removeItem("a");
    expect((await outbox.pending()).map((i) => i.client_id)).toEqual(["b"]);
  });
});

describe("flushOutbox", () => {
  test("empty queue is a no-op and never calls the server", async () => {
    const res = await outbox.flushOutbox();
    expect(res).toEqual({ synced: 0, remaining: 0 });
    expect(syncExpenses).not.toHaveBeenCalled();
  });

  test("a full successful drain sends every item and clears the queue", async () => {
    await outbox.enqueue({ ...item("a"), queued_at: "t" });
    await outbox.enqueue({ ...item("b"), queued_at: "t" });
    syncExpenses.mockResolvedValue({ synced: 2, expenses: [saved("a"), saved("b")] });

    const res = await outbox.flushOutbox();

    expect(syncExpenses).toHaveBeenCalledTimes(1);
    // Payload is the wire shape — no queued_at leaks to the server.
    expect(syncExpenses.mock.calls[0][0]).toEqual([
      { client_id: "a", amount_cents: 100, category_id: "food", note: undefined, spent_at: undefined },
      { client_id: "b", amount_cents: 100, category_id: "food", note: undefined, spent_at: undefined },
    ]);
    expect(res).toEqual({ synced: 2, remaining: 0 });
    expect(await outbox.pending()).toHaveLength(0);
  });

  // THE load-bearing property: going offline must never lose a logged expense.
  test("a failed sync retains every item for retry — nothing is lost", async () => {
    await outbox.enqueue({ ...item("a"), queued_at: "t" });
    await outbox.enqueue({ ...item("b"), queued_at: "t" });
    syncExpenses.mockRejectedValue(new Error("offline"));

    const res = await outbox.flushOutbox();

    expect(res).toEqual({ synced: 0, remaining: 2 });
    expect((await outbox.pending()).map((i) => i.client_id).sort()).toEqual(["a", "b"]);
  });

  test("retry after a failure then a success drains cleanly", async () => {
    await outbox.enqueue({ ...item("a"), queued_at: "t" });
    syncExpenses.mockRejectedValueOnce(new Error("offline"));
    await outbox.flushOutbox(); // fails, item retained
    syncExpenses.mockResolvedValueOnce({ synced: 1, expenses: [saved("a")] });

    const res = await outbox.flushOutbox();
    expect(res.synced).toBe(1);
    expect(await outbox.pending()).toHaveLength(0);
  });

  // Data-integrity edge: the server skips items it can't accept (e.g. an unknown category) and
  // returns only the ones it saved. The outbox must retain what the server did NOT confirm, or a
  // dropped item vanishes from the queue silently — permanent, invisible data loss.
  test("a partial sync retains the items the server did not confirm", async () => {
    await outbox.enqueue({ ...item("a"), queued_at: "t" });
    await outbox.enqueue({ ...item("b"), queued_at: "t" }); // server will skip this one
    await outbox.enqueue({ ...item("c"), queued_at: "t" });
    syncExpenses.mockResolvedValue({ synced: 2, expenses: [saved("a"), saved("c")] });

    const res = await outbox.flushOutbox();

    expect(res.synced).toBe(2);
    expect(await outbox.pending().then((p) => p.map((i) => i.client_id))).toEqual(["b"]);
  });
});
