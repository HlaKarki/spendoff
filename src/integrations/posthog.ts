import type { PostHog } from "posthog-js";

import { env } from "../env";

/**
 * PostHog loads lazily and only in the browser: SSR must never touch it, and unit
 * tests import modules (outbox) that call track() — with no init, every call here
 * is a no-op. Events fired before init resolves are dropped, which is fine: the
 * SDK captures the initial pageview itself once it's up.
 */
let client: PostHog | null = null;

export async function initPostHog(): Promise<void> {
  if (client || typeof window === "undefined" || !env.VITE_POSTHOG_KEY) return;
  const { default: posthog } = await import("posthog-js");
  posthog.init(env.VITE_POSTHOG_KEY, {
    api_host: env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com",
    // Opts into history-change pageviews, so SPA navigations count without router wiring.
    defaults: "2025-05-24",
    person_profiles: "identified_only",
  });
  client = posthog;
}

export function identify(id: string, props?: Record<string, unknown>): void {
  client?.identify(id, props);
}

export function track(event: string, props?: Record<string, unknown>): void {
  client?.capture(event, props);
}
