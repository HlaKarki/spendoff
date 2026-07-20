/* Spendoff service worker — hand-rolled (vite-plugin-pwa is incompatible with TanStack Start).
 * Responsibilities: web push display + Background Sync replay of the offline expense outbox. */

importScripts("https://cdn.jsdelivr.net/npm/idb@8/build/umd.js");

const DB_NAME = "spendoff";
const STORE = "outbox";
const SYNC_URL = "/api/v1/spendoff/expenses/sync";
// Must equal DB_VERSION in src/lib/outbox.ts. Opening at a LOWER version than the one on disk
// doesn't fall back — IndexedDB rejects with VersionError, which killed this whole handler between
// fbb2542 (which bumped the app to 2) and HLA-191. `sw-outbox.test.ts` now pins the two together.
const DB_VERSION = 2;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// ── Web Push ────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Spendoff", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Spendoff", {
      body: data.body || "",
      icon: "/logo192.png",
      badge: "/logo192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const hit = wins.find((w) => w.url.includes(url));
      return hit ? hit.focus() : self.clients.openWindow(url);
    }),
  );
});

// ── Background Sync: drain the offline outbox ────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-expenses") event.waitUntil(flushOutbox());
});

/**
 * The closed-tab half of the outbox drain. `src/lib/outbox.ts` owns the same job while a tab is
 * alive; this runs when the browser fires Background Sync with no page around to do it.
 *
 * It must stay behaviourally identical to `flushOutbox()` there — the two have drifted twice, so
 * `src/lib/sw-outbox.test.ts` now reads this file and fails if they part ways again. Two rules:
 *
 *   1. Forward every field the item carries. Dropping one doesn't fail loudly; it rewrites the
 *      expense. An item queued in EUR that arrives with no `currency` is booked at the user's base
 *      currency instead — €50 silently becomes $50.
 *   2. Delete only what the server confirmed. It skips items it can't accept (unknown category) or
 *      can't yet price (a foreign currency while the rate feed is behind) and echoes back the rest.
 *      Clearing the store on a bare 200 throws the skipped ones away.
 */
async function flushOutbox() {
  const db = await self.idb.openDB(DB_NAME, DB_VERSION);
  let items;
  try {
    items = await db.getAll(STORE);
  } catch {
    return; // store not created yet
  }
  if (!items || items.length === 0) return;

  const res = await fetch(SYNC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      items: items.map((i) => ({
        client_id: i.client_id,
        amount_cents: i.amount_cents,
        currency: i.currency,
        category_id: i.category_id,
        note: i.note,
        spent_at: i.spent_at,
      })),
    }),
  });
  if (!res.ok) throw new Error("sync failed"); // reject → browser retries later

  const body = await res.json();
  const confirmed = new Set((body.expenses || []).map((e) => e.client_id));
  const tx = db.transaction(STORE, "readwrite");
  for (const i of items) if (confirmed.has(i.client_id)) await tx.store.delete(i.client_id);
  await tx.done;

  // A skipped item stays queued. Ask for another sync so it isn't stranded until the next log —
  // by then the category may exist, or the rate feed may have caught up.
  if (confirmed.size < items.length) throw new Error("partial sync"); // reject → browser retries later
}
