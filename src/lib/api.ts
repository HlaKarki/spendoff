import type { Battle, BattleDetail, Category, Expense, MonthlyResult, StandingsResult, User, WinRule } from "./types";

// Same-origin by default (dev: Vite proxy → :8787; prod: same-origin proxy / service binding).
// Set VITE_API_BASE to the backend origin if you instead call it cross-origin (needs CORS+credentials).
const API_ORIGIN = import.meta.env.VITE_API_BASE ?? "";
const BASE = `${API_ORIGIN}/api/v1/spendoff`;

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    body,
    credentials: "include",
  });

  if (!res.ok) {
    let code = "error";
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      code = data.error ?? code;
      message = data.message ?? message;
    } catch {
      // non-JSON error
    }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Auth ───────────────────────────────────────────────────────────────────
export const api = {
  me: () => apiFetch<{ user: User }>("/auth/me"),
  logout: () => apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  registerOptions: (json: { email: string; display_name: string; timezone?: string }) =>
    apiFetch<Record<string, unknown>>("/auth/register/options", { method: "POST", json }),
  registerVerify: (json: { response: unknown }) =>
    apiFetch<{ user: User }>("/auth/register/verify", { method: "POST", json }),
  loginOptions: (json: { email?: string }) =>
    apiFetch<Record<string, unknown>>("/auth/login/options", { method: "POST", json }),
  loginVerify: (json: { response: unknown }) =>
    apiFetch<{ user: User }>("/auth/login/verify", { method: "POST", json }),
  magicRequest: (json: { email: string; timezone?: string }) =>
    apiFetch<{ ok: boolean; dev_link?: string }>("/auth/magic-link/request", { method: "POST", json }),
  magicVerify: (json: { token: string }) =>
    apiFetch<{ user: User }>("/auth/magic-link/verify", { method: "POST", json }),

  // ── Categories ────────────────────────────────────────────────────────────
  categories: () => apiFetch<{ categories: Category[] }>("/categories"),

  // ── Battles ───────────────────────────────────────────────────────────────
  listBattles: () => apiFetch<{ battles: Battle[] }>("/battles"),
  createBattle: (json: { name: string; currency?: string }) =>
    apiFetch<{ battle: Battle }>("/battles", { method: "POST", json }),
  joinBattle: (json: { invite_code: string }) =>
    apiFetch<{ battle: Battle }>("/battles/join", { method: "POST", json }),
  getBattle: (id: string) => apiFetch<BattleDetail>(`/battles/${id}`),
  updateBattle: (id: string, json: { name?: string; rotate_invite?: boolean }) =>
    apiFetch<{ battle: Battle }>(`/battles/${id}`, { method: "PATCH", json }),
  leaveBattle: (id: string) => apiFetch<{ ok: boolean }>(`/battles/${id}/leave`, { method: "POST" }),
  setWinRule: (id: string, ym: string, json: { win_rule: WinRule }) =>
    apiFetch<{ ok: boolean }>(`/battles/${id}/settings/${ym}`, { method: "PUT", json }),
  setBudget: (id: string, ym: string, json: { budget_cents: number }) =>
    apiFetch<{ ok: boolean }>(`/battles/${id}/budget/${ym}`, { method: "PUT", json }),

  // ── Expenses ──────────────────────────────────────────────────────────────
  createExpense: (
    json: { amount_cents: number; category_id: string; note?: string | null; spent_at?: string; client_id?: string },
    idempotencyKey?: string,
  ) =>
    apiFetch<{ expense: Expense }>("/expenses", {
      method: "POST",
      json,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }),
  syncExpenses: (
    items: Array<{
      client_id: string;
      amount_cents: number;
      category_id: string;
      note?: string | null;
      spent_at?: string;
    }>,
  ) => apiFetch<{ synced: number; expenses: Expense[] }>("/expenses/sync", { method: "POST", json: { items } }),
  listExpenses: (params?: { year_month?: string; category_id?: string; limit?: number; cursor?: string }) => {
    const q = new URLSearchParams();
    if (params?.year_month) q.set("year_month", params.year_month);
    if (params?.category_id) q.set("category_id", params.category_id);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.cursor) q.set("cursor", params.cursor);
    const qs = q.toString();
    return apiFetch<{ expenses: Expense[]; next_cursor: string | null }>(`/expenses${qs ? `?${qs}` : ""}`);
  },
  updateExpense: (
    id: string,
    json: { amount_cents?: number; category_id?: string; note?: string | null; spent_at?: string },
  ) => apiFetch<{ expense: Expense }>(`/expenses/${id}`, { method: "PATCH", json }),
  deleteExpense: (id: string) => apiFetch<{ ok: boolean }>(`/expenses/${id}`, { method: "DELETE" }),

  // ── Standings & results ───────────────────────────────────────────────────
  standings: (id: string, ym?: string) =>
    apiFetch<StandingsResult>(`/battles/${id}/standings${ym ? `?year_month=${ym}` : ""}`),
  listResults: (id: string) => apiFetch<{ results: MonthlyResult[] }>(`/battles/${id}/results`),
  getResult: (id: string, ym: string) => apiFetch<{ result: MonthlyResult }>(`/battles/${id}/results/${ym}`),
  closeMonth: (id: string, ym: string) =>
    apiFetch<{ result: MonthlyResult }>(`/battles/${id}/close/${ym}`, { method: "POST" }),

  // ── Push ──────────────────────────────────────────────────────────────────
  pushPublicKey: () => apiFetch<{ public_key: string }>("/push/public-key"),
  pushSubscribe: (json: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    apiFetch<{ ok: boolean }>("/push/subscribe", { method: "POST", json }),
  pushUnsubscribe: (json: { endpoint: string }) =>
    apiFetch<{ ok: boolean }>("/push/unsubscribe", { method: "POST", json }),
  notifyTest: () => apiFetch<{ ok: boolean; channel: "push" | "email" | "none" }>("/notify/test", { method: "POST" }),
};
