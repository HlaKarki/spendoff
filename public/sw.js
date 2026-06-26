/* Spendoff service worker — hand-rolled (vite-plugin-pwa is incompatible with TanStack Start).
 * Responsibilities: web push display + Background Sync replay of the offline expense outbox. */

importScripts("https://cdn.jsdelivr.net/npm/idb@8/build/umd.js");

const DB_NAME = "spendoff";
const STORE = "outbox";
const SYNC_URL = "/api/v1/spendoff/expenses/sync";

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

async function flushOutbox() {
  const db = await self.idb.openDB(DB_NAME, 1);
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
        category_id: i.category_id,
        note: i.note,
        spent_at: i.spent_at,
      })),
    }),
  });
  if (!res.ok) throw new Error("sync failed"); // reject → browser retries later

  const tx = db.transaction(STORE, "readwrite");
  for (const i of items) await tx.store.delete(i.client_id);
  await tx.done;
}
