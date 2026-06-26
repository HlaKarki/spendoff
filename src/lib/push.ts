import { api } from "./api";
import { flushOutbox } from "./outbox";

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Register the service worker once (client-only). Also kicks an outbox flush. */
export async function registerServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    void flushOutbox();
  } catch (err) {
    console.error("SW registration failed", err);
  }
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "Notifications aren't supported on this device." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Notifications permission was declined." };

  let key: string;
  try {
    key = (await api.pushPublicKey()).public_key;
  } catch {
    return { ok: false, reason: "Push isn't configured on the server yet." };
  }

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  });
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await api.pushSubscribe({ endpoint: json.endpoint, keys: json.keys });
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  const sub = await currentPushSubscription();
  if (sub) {
    await api.pushUnsubscribe({ endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
}
