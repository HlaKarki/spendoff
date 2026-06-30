// API types mirroring the Spendoff backend (/api/v1/spendoff/*).

export type WinRule = "lowest_total" | "most_under_budget" | "lowest_with_category_wins";

export interface User {
  id: string;
  email: string;
  display_name: string;
  timezone: string;
  created_at: string | null;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
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
}

export interface BattleDetail {
  battle: Battle;
  members: BattleMember[];
  year_month: string;
  win_rule: WinRule;
  my_budget_cents: number | null;
}

export interface Expense {
  id: string;
  client_id: string;
  amount_cents: number;
  currency: string;
  category_id: string;
  note: string | null;
  spent_at: string;
  year_month: string;
  created_at: string | null;
  updated_at: string | null;
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
