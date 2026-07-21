// API types mirroring the Spendoff backend (/api/v1/spendoff/*).

export type WinRule = "lowest_total" | "most_under_budget" | "lowest_with_category_wins";

export interface User {
  id: string;
  email: string;
  display_name: string;
  timezone: string;
  /** The currency this user's own totals are denominated in. Battles score in the battle's currency. */
  base_currency: string;
  created_at: string | null;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
}

export interface Currency {
  code: string;
  label: string;
  symbol: string;
  /** ISO 4217 minor units — 2 for USD, 0 for JPY. Needed to parse or render an amount at all. */
  decimals: number;
}

export interface Battle {
  id: string;
  name: string;
  invite_code: string;
  currency: string;
  created_by: string;
  created_at: string | null;
  role: string;
  member_count: number;
}

export interface BattleMember {
  user_id: string;
  display_name: string;
  role: string;
  joined_at: string | null;
  /** Whether this member lets THIS battle read their log. Your own row carries your toggle state. */
  share_history: boolean;
}

export interface BattleDetail {
  battle: Battle;
  members: BattleMember[];
  year_month: string;
  win_rule: WinRule;
  my_budget_cents: number | null;
}

/**
 * `amount_cents`/`currency` are what was actually spent. The `base_*` fields are that same spend
 * converted once, at write time, into the owner's base currency — frozen, so a rate move later can't
 * restate it. `rate_date` is the rate's publication date, so a converted figure can say where it
 * came from.
 */
export interface Expense {
  id: string;
  client_id: string;
  amount_cents: number;
  currency: string;
  base_currency: string;
  base_amount_cents: number;
  rate_to_base: number;
  rate_date: string | null;
  category_id: string;
  note: string | null;
  spent_at: string;
  year_month: string;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * An item `POST /expenses/sync` refused, and whether another flush could plausibly save it
 * (HLA-194). `retryable: false` means permanently invalid — an unknown category won't become known
 * — so the queue may finally drop it instead of re-sending it forever. `reason`/`message` are for
 * logs; branch on `retryable`, which needs no update when the server grows a new failure mode.
 *
 * Optional because a server predating the field simply omits it, and "not told" must keep meaning
 * "keep the item".
 */
export interface SyncSkipped {
  client_id: string;
  reason: string;
  retryable: boolean;
  message: string;
}

/**
 * Another member's expense. Deliberately narrower than `Expense`: no `note`, because free text is
 * where the private detail lives and it never leaves its owner's account.
 */
export interface SharedExpense {
  id: string;
  amount_cents: number;
  currency: string;
  base_currency: string;
  base_amount_cents: number;
  category_id: string;
  spent_at: string;
  year_month: string;
}

/** `shared: false` isn't an error — it's "this player keeps their log private", and the UI says so. */
export interface MemberHistory {
  user_id: string;
  display_name: string;
  year_month: string;
  shared: boolean;
  expenses: SharedExpense[];
}

export interface RecurringExpense {
  id: string;
  amount_cents: number;
  currency: string;
  category_id: string;
  note: string | null;
  day_of_month: number;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// ── Personal analytics ─────────────────────────────────────────────────────

export interface AnalyticsCategoryTotal {
  category_id: string;
  label: string;
  icon: string;
  total_cents: number;
}

export interface AnalyticsMonthTotal {
  year_month: string;
  total_cents: number;
}

export interface AnalyticsDayTotal {
  date: string;
  total_cents: number;
}

/** Every total here is in `base_currency`, summed from each expense's frozen conversion. */
export interface Analytics {
  year_month: string;
  base_currency: string;
  month_total_cents: number;
  by_category: AnalyticsCategoryTotal[];
  daily: AnalyticsDayTotal[];
  monthly: AnalyticsMonthTotal[];
}

// ── Scoring snapshot (camelCase, self-contained blob) ──────────────────────

export interface Standing {
  userId: string;
  displayName: string;
  totalCents: number;
  budgetCents: number | null;
  underBudgetCents: number | null;
  rank: number;
  loggedCount: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  key: string;
  label: string;
  perUser: { userId: string; totalCents: number }[];
  winnerUserId: string | null;
}

export interface Trends {
  biggestSplurge: { userId: string; expenseId: string; amountCents: number; label: string } | null;
  mostExpensiveDay: { userId: string; date: string; totalCents: number } | null;
  dailyTotals: { date: string; perUser: { userId: string; totalCents: number }[] }[];
  winStreaks: { userId: string; months: number }[];
}

export interface MonthlyResultSnapshot {
  battleId: string;
  yearMonth: string;
  currency: string;
  winRule: WinRule;
  winnerUserId: string | null;
  isTie: boolean;
  standings: Standing[];
  categories: CategoryBreakdown[];
  trends: Trends;
  callouts: string[];
}

export interface MonthlyResult {
  battle_id: string;
  year_month: string;
  win_rule: WinRule;
  winner_user_id: string | null;
  snapshot: MonthlyResultSnapshot;
  computed_at: string | null;
}

export interface StandingsResult {
  year_month: string;
  win_rule: WinRule;
  result: MonthlyResultSnapshot;
}
