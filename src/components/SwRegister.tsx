import { useEffect } from "react";
import { flushOutbox } from "../lib/outbox";
import { registerServiceWorker } from "../lib/push";

/** Client-only: registers the service worker and replays the outbox when back online. */
export function SwRegister() {
  useEffect(() => {
    void registerServiceWorker();
    const onOnline = () => void flushOutbox();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
  return null;
}
