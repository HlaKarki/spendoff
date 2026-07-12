# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use **bun**, never npm/pnpm/yarn — including for shadcn (`bunx shadcn@latest add button`). `.cursorrules` says `pnpm dlx`; ignore that part.

```bash
bun run dev        # vite dev server on :3000
bun run check      # typecheck + lint + format:check + test — the deploy gate and what CI runs
bun run typecheck  # tsc --noEmit
bun run lint       # oxlint (a few pre-existing warnings are expected; keep them at zero *new*)
bun run format     # prettier --write   (format:check is what gates)
bun run test       # vitest run (unit)
bun run test:e2e   # playwright (boots the frontend itself; needs the backend on :8787)
```

Single test: `bunx vitest run src/lib/format.test.ts` · one case: `bunx vitest run -t "spentAtForDay"` · one e2e: `bunx playwright test -g "log an expense"`.

## The two-repo split

This repo is **only the frontend**. The API — auth, scoring, month close, cron, notifications — lives in a separate repo, `hla-backend` (Hono + chanfana on Cloudflare Workers, D1 + KV). It is usually checked out beside this one at `../hla-backend`; **read it before assuming an API contract**, because there is no shared package and types are hand-mirrored (`src/lib/types.ts` here vs. the zod schemas there, which are the real contract).

The API is same-origin by design (first-party cookies, no CORS):

- **dev** — `vite.config.ts` proxies `/api/v1/spendoff/*` → `http://localhost:8787`
- **prod** — `src/server.ts` forwards the same prefix to the `BACKEND` service binding

`src/lib/api.ts` is the single typed client; every call goes through `apiFetch` with `credentials: "include"`, and non-2xx becomes an `ApiError` carrying `{ status, code }`.

**A backend that's mid-migration surfaces here as an opaque 500.** Drizzle `select()` expands to every column in its schema, so if the backend's local D1 is behind its code, _any_ read of that table 500s — and it shows up on whichever endpoint touches it first, not as a migration error. Fix in `hla-backend`: `bunx wrangler d1 migrations apply general-backend --local`.

## Dates, timezones, money — the invariants

These carry most of the domain complexity. Get them wrong and the bug is silent.

- **`spent_at` (UTC ISO) is the only stored timestamp.** There is no day column. The backend derives `year_month` from `spent_at` **in the user's timezone**; calendar days are computed at query time. Changing your timezone re-buckets history.
- **The account's timezone is the truth, not the device's.** It arrives with `useMe`, so it's `undefined` on first render. Every date helper in `src/lib/format.ts` funnels through `resolveTimezone()`, which falls back to the device zone until it resolves. **Derive dates during render; never seed them into `useState`** — that pins the value to the device zone forever. The existing code says so at each site; follow the pattern.
- **`src/lib/format.ts` mirrors backend date logic** (`dayInTz`, `yearMonthInTz`, `tzOffsetMs`, DST-safe two-pass conversion). If you change one side, change the other.
- **A month locks once it rolls over.** Editing or deleting an expense in a past month returns `409 month_closed`, and a closed month's result is settled. That's why the log screen's date picker (`loggableDayRange`) only offers the current month — a row logged into a closed month couldn't be taken back and could rewrite a decided winner. A future day _within_ the month is allowed and counts immediately.
- **Amounts are integer minor units, not "cents".** Minor units per major unit is a property of the currency and is **not** always 100 (¥1000 is a thousand yen). Never divide by a hard-coded 100 — use `toMajor`/`toMinor`/`money` in `format.ts`, which ask `Intl`. A user's own totals render in their `base_currency`; anything battle-scoped renders in that **battle's** currency.

## Offline logging

`src/lib/outbox.ts` is the single write path for a spend: `logExpense()` → enqueue into an IndexedDB store keyed by `client_id` → register Background Sync → try to flush immediately. `flushOutbox()` POSTs the whole queue to `/expenses/sync` and **deletes only the rows the server echoed back** — the server skips items it can't accept (e.g. an unknown category), and removing an unconfirmed item would lose it silently. Dedupe is server-side on `(user_id, client_id)`, so a replay never double-inserts.

`public/sw.js` re-implements that flush for the Background Sync event. It is a **hand-maintained mirror** — change one and you must change the other. (It currently clears the whole store on a 200, which is the data-loss case `outbox.ts` deliberately avoids.)

## UI conventions

- Routes are TanStack Router file-routes in `src/routes/`; `routeTree.gen.ts` is generated (`bun run generate-routes`) — never hand-edit.
- Anything touching IndexedDB, `Intl`, or the account's timezone renders inside `<ClientOnly>` — SSR would resolve dates in the server's zone.
- Mutations mostly use react-query + an explicit `invalidate()` of the affected keys (`["expenses"]`, `["analytics"]`, `["standings", id]`, `["battle", id]`, `["battles"]`). There are no optimistic updates; don't add one without handling the offline path.
- No sparkle/star icons.

## Testing

`vitest.config.ts` is standalone on purpose — loading `vite.config.ts` would drag in the Cloudflare Workers plugin and fail. Unit tests are `src/**/*.test.ts`, `node` environment by default; a component test opts into the DOM with `// @vitest-environment jsdom` at the top of the file. Date helpers are tested by pinning the clock (`vi.setSystemTime`) and asserting across two zones (Toronto/Tokyo) plus both DST transitions — the cases that actually break.

E2E (`e2e/smoke.spec.ts`) drives a real browser through signup → log → confirm. It boots the frontend but **needs `hla-backend` running on :8787**, so it can't run in CI or from a clean clone.

When verifying UI, **click the control the way a user does**. Setting a value with Playwright's `.fill()` fires `onChange` and passes even when the control is inert for a real user (a native date input, for instance, only opens its calendar from its indicator icon).
