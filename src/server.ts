import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

// Custom server entry (auto-resolved by the TanStack Start plugin as `src/server`).
// In production it forwards the Spendoff API to the hla-backend worker over a Cloudflare
// **service binding** (BACKEND → general-backend), keeping the API same-origin: first-party
// cookies, no CORS. In local dev the Vite `server.proxy` intercepts /api first, so this
// branch only runs in deployed environments.
const handler = createStartHandler(defaultStreamHandler);

type Backend = { fetch: (request: Request) => Promise<Response> };

export default {
  async fetch(request: Request, env: { BACKEND?: Backend }): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/v1/spendoff") && env?.BACKEND) {
      return env.BACKEND.fetch(request);
    }
    return handler(request);
  },
};
