# Spendoff

> A competitive personal-spending tracker. Log in two taps, settle it monthly, lowest spender wins.

**Live:** [spendoff.us](https://spendoff.us) · **iPhone:** [App Store](https://apps.apple.com/us/app/spendoff/id6794655495) · **Writeup:** [hla.dev/builds/spendoff](https://hla.dev/builds/spendoff)

![Spendoff](assets/banner.png)

Spendoff is a PWA where you and your friends or family each log your own spending, fast. At the end of every month it's a head-to-head: the lowest spender wins, with a full breakdown by category, spending trends, and playful callouts. It's not bill-splitting. Spending is personal; the competition is the point.

<p align="center">
  <img src="assets/dashboard.png" width="31%" alt="Live standings" />
  <img src="assets/log.png" width="31%" alt="Two-tap logging" />
  <img src="assets/showdown.png" width="31%" alt="Month-end showdown" />
</p>

## Highlights

- **Offline-first logging.** A spend writes to an IndexedDB outbox first and syncs via Background Sync (with an `online`/on-mount replay fallback). Idempotency keys mean it never double-inserts, so logging never fails on a flaky connection.
- **Passwordless auth.** Passkeys (WebAuthn) with an email magic-link fallback for new devices.
- **A pure scoring engine.** Three win rules, ties, zero-log handling, per-category winners, trends, and callouts, all in one deterministic function. Two players render as a head-to-head; three-plus becomes a leaderboard.
- **Installable PWA.** Web app manifest, hand-rolled service worker, and web push.
- **Cross-device convergence.** D1 stays authoritative; live views refresh on focus and poll only
  while visible, while confirmed background outbox writes invalidate every affected cache.

## Stack

This repo is the **frontend**:

- [TanStack Start](https://tanstack.com/start) (React 19) on Cloudflare Workers
- Tailwind v4, TanStack Query, `motion`, shadcn primitives
- oxlint + Prettier, TypeScript

The **backend** (auth, the scoring engine, cron-driven month close, notifications) runs as a [Hono](https://hono.dev) + [chanfana](https://chanfana.com) module on Cloudflare Workers with **D1** (SQLite) and **KV**, deployed as part of a private shared backend. In production the browser only talks to `spendoff.us`: a custom server entry forwards `/api/v1/spendoff/*` to that backend over a Cloudflare **service binding**, so the API stays same-origin (first-party cookies, no CORS).

> The backend isn't included in this repo, so the app won't run end to end from a clean clone without one. The frontend code, offline queue, PWA, and UI are all here.

## Cross-device data freshness

D1 is the authoritative ledger. Dynamic authenticated queries always refetch when the tab becomes
visible, the browser window regains focus, or connectivity returns. Expense, analytics, standings,
and shared-history views also poll every 15 seconds while mounted; TanStack Query suppresses that
polling in hidden or offline tabs.

Successful page-side and service-worker outbox flushes invalidate the expense, analytics, and
standings query families. Active views refetch immediately and inactive views are marked stale, so a
confirmed native expense appears when the user returns to the web app without creating a second
source of truth.

## Native Apple association

The native bundle identifier is `us.spendoff.app`, and its Expo config declares
`webcredentials:spendoff.us` and `applinks:spendoff.us`. The production association file uses the
signed app identifier `93AV3DLH8S.us.spendoff.app`. It is served extensionless from
`https://spendoff.us/.well-known/apple-app-site-association` as `application/json`, without a
redirect. Universal links are deliberately limited to `/auth/magic`; shared passkey credentials use
the same fully qualified app identifier.

## Local development

```bash
bun install
bun run dev      # http://localhost:3000
```

In dev, `vite.config.ts` proxies `/api/v1/spendoff/*` to a local backend at `http://localhost:8787`.

## Scripts

```bash
bun run dev        # vite dev server
bun run build      # production build
bun run lint       # oxlint
bun run typecheck  # tsc --noEmit
bun run format     # prettier --write
bun run deploy     # build + wrangler deploy
```

## License

[MIT](LICENSE) © Hla Htun
