import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, LogOut, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { CategoryIcon } from "../components/icons";
import { StandingsRows } from "../components/Standings";
import { api } from "../lib/api";
import {
  currentDayOfMonth,
  currentYearMonth,
  datetimeLocalInTz,
  datetimeLocalToUtc,
  formatMonth,
  formatMonthShort,
  formatTime,
  money,
  relativeDayKey,
} from "../lib/format";
import {
  useAnalytics,
  useBattle,
  useCategories,
  useDayExpenses,
  useMe,
  useResults,
  useStandings,
  useTimezone,
} from "../lib/queries";
import type { Category, Expense, WinRule } from "../lib/types";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/battles/$id/")({
  component: () => (
    <ClientOnly>
      <AppShell>
        <BattleDetail />
      </AppShell>
    </ClientOnly>
  ),
});

const RULES: { value: WinRule; label: string }[] = [
  { value: "lowest_total", label: "Lowest total" },
  { value: "most_under_budget", label: "Under budget" },
  { value: "lowest_with_category_wins", label: "Lowest + cats" },
];

function BattleDetail() {
  const { id } = Route.useParams();
  const me = useMe();
  const detail = useBattle(id);
  const standings = useStandings(id);
  const results = useResults(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const setRule = useMutation({
    mutationFn: (rule: WinRule) => api.setWinRule(id, detail.data!.year_month, { win_rule: rule }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["battle", id] });
      qc.invalidateQueries({ queryKey: ["standings", id] });
    },
  });

  const leave = useMutation({
    mutationFn: () => api.leaveBattle(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["battles"] });
      navigate({ to: "/battles" });
    },
  });

  if (detail.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  if (!detail.data) return <p className="text-muted">Battle not found.</p>;

  const b = detail.data.battle;
  const isOwner = b.role === "owner";
  const ym = detail.data.year_month;

  function copyCode() {
    navigator.clipboard?.writeText(b.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-2">
        <Link to="/battles" className="text-faint">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">{b.name}</h1>
      </header>

      {/* Invite */}
      <button onClick={copyCode} className="card flex w-full items-center justify-between px-4 py-3">
        <div className="text-left">
          <div className="label">Invite code</div>
          <div className="font-mono text-lg font-bold tracking-widest">{b.invite_code}</div>
        </div>
        {copied ? <Check className="size-5 text-accent" /> : <Copy className="size-5 text-faint" />}
      </button>

      {/* Live standings */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{formatMonth(ym)}</h2>
          <span className="text-xs text-faint">live</span>
        </div>
        {standings.data ? (
          <StandingsRows snapshot={standings.data.result} meId={me.data?.id ?? null} currency={b.currency} />
        ) : (
          <div className="h-24 animate-pulse rounded-xl bg-surface" />
        )}
        {standings.data?.result.callouts.slice(0, 1).map((c, i) => (
          <p key={i} className="rounded-xl bg-surface px-4 py-3 text-sm text-muted">
            {c}
          </p>
        ))}
      </section>

      {/* Your spend */}
      <MySpend
        id={id}
        // oxlint-disable-next-line no-array-sort -- Array.from creates a fresh array, safe to sort in place
        months={Array.from(new Set([ym, ...(results.data?.map((r) => r.year_month) ?? [])])).sort()}
        currency={b.currency}
      />

      {/* Win rule */}
      <section className="space-y-2">
        <h2 className="label">Win rule {!isOwner && "(owner sets this)"}</h2>
        <div className="grid grid-cols-3 gap-2">
          {RULES.map((r) => (
            <button
              key={r.value}
              disabled={!isOwner || setRule.isPending}
              onClick={() => setRule.mutate(r.value)}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-xs font-semibold transition",
                detail.data!.win_rule === r.value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line bg-surface text-muted",
                !isOwner && "opacity-60",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        {detail.data.win_rule === "most_under_budget" && (
          <BudgetEditor id={id} ym={ym} current={detail.data.my_budget_cents} />
        )}
      </section>

      {/* Members */}
      <section className="space-y-2">
        <h2 className="label">Players</h2>
        <div className="card divide-y divide-line">
          {detail.data.members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">
                {m.display_name}
                {m.user_id === me.data?.id && <span className="ml-2 text-xs text-faint">you</span>}
              </span>
              <span className="text-xs text-faint">{m.role}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Past results */}
      {results.data && results.data.length > 0 && (
        <section className="space-y-2">
          <h2 className="label">Past months</h2>
          <div className="space-y-2">
            {results.data.map((r) => (
              <Link key={r.year_month} to="/battles/$id/results/$ym" params={{ id, ym: r.year_month }} className="block">
                <div className="card flex items-center justify-between px-4 py-3 transition active:scale-[0.99]">
                  <span className="font-semibold">{formatMonthShort(r.year_month)}</span>
                  <WinnerChip result={r} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <button onClick={() => leave.mutate()} disabled={leave.isPending} className="btn-ghost w-full py-3 text-danger">
        <LogOut className="size-4" /> Leave battle
      </button>
    </div>
  );
}

// Days of the battle month, oldest→newest, not past today for the current month.
function monthDays(ym: string, tz?: string): string[] {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cap = ym === currentYearMonth(tz) ? currentDayOfMonth(tz) : last;
  return Array.from({ length: cap }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
}

function chipParts(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  // The weekday of a calendar date is a property of the date, not of any zone — build and read it
  // in UTC so the chip can't drift with the device.
  const date = new Date(Date.UTC(y, m - 1, d));
  return { weekday: date.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" }), day: d };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function MySpend({ id, months, currency }: { id: string; months: string[]; currency: string }) {
  const [sel, setSel] = useState(months[months.length - 1]);
  const idx = Math.max(0, months.indexOf(sel));
  const ym = months[idx];
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="label">Your spend</h2>
        {months.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSel(months[idx - 1])}
              disabled={idx === 0}
              className="text-faint disabled:opacity-30"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-5" />
            </button>
            <span className="min-w-[5.5rem] text-center text-sm font-semibold">{formatMonthShort(ym)}</span>
            <button
              onClick={() => setSel(months[idx + 1])}
              disabled={idx === months.length - 1}
              className="text-faint disabled:opacity-30"
              aria-label="Next month"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}
      </div>
      <MonthSpend key={ym} id={id} ym={ym} currency={currency} />
    </section>
  );
}

function MonthSpend({ id, ym, currency }: { id: string; ym: string; currency: string }) {
  const me = useMe();
  const tz = me.data?.timezone;
  const summary = useAnalytics({ year_month: ym, months: 1 });
  const categories = useCategories();
  const catFor = (categoryId: string) => categories.data?.find((c) => c.id === categoryId) ?? null;
  const [catFilter, setCatFilter] = useState<string | null>(null);

  const days = useMemo(() => monthDays(ym, tz), [ym, tz]);
  const daysWithSpend = useMemo(() => new Set(summary.data?.daily.map((d) => d.date) ?? []), [summary.data]);

  const todayKey = `${currentYearMonth(tz)}-${pad2(currentDayOfMonth(tz))}`;
  const [selected, setSelected] = useState(days.includes(todayKey) ? todayKey : days[days.length - 1]);

  // Only the selected day's rows are fetched (server resolves the day in the user's tz).
  const dayExpenses = useDayExpenses(selected, catFilter ?? undefined);
  // oxlint-disable-next-line no-array-sort -- .slice() already copies before sorting
  const dayItems = (dayExpenses.data ?? []).slice().sort((a, b) => b.spent_at.localeCompare(a.spent_at));
  const dayTotal = dayItems.reduce((s, e) => s + e.amount_cents, 0);

  // Month/category totals come from the cheap aggregate, not a full-month row download.
  const monthTotal = catFilter
    ? (summary.data?.by_category.find((c) => c.category_id === catFilter)?.total_cents ?? 0)
    : (summary.data?.month_total_cents ?? 0);

  const stripRef = useRef<HTMLDivElement | null>(null);
  const selRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const c = stripRef.current;
    const el = selRef.current;
    if (c && el) c.scrollLeft = el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2;
  }, [summary.isLoading]);

  if (summary.isLoading) return <div className="h-28 animate-pulse rounded-xl bg-surface" />;

  return (
    <div className="space-y-3">
      {/* Category filter */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setCatFilter(null)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                catFilter === null ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-muted",
              )}
            >
              All
            </button>
            {categories.data?.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatFilter(c.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  catFilter === c.id ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-muted",
                )}
              >
                <CategoryIcon name={c.icon} className="size-3.5" />
                {c.label}
              </button>
            ))}
          </div>

          {catFilter && (
            <p className="px-1 text-xs text-faint">
              {catFor(catFilter)?.label} in {formatMonthShort(ym)}:{" "}
              <span className="font-semibold text-muted">{money(monthTotal, currency)}</span>
            </p>
          )}

          {/* Day switcher */}
          <div
            ref={stripRef}
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {days.map((k) => {
              const isSel = k === selected;
              const has = daysWithSpend.has(k);
              const { weekday, day } = chipParts(k);
              return (
                <button
                  key={k}
                  ref={isSel ? selRef : undefined}
                  onClick={() => setSelected(k)}
                  className={cn(
                    "flex min-w-[3rem] shrink-0 flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition",
                    isSel ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-muted",
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase">{weekday}</span>
                  <span className="text-base font-bold leading-none tabular-nums">{day}</span>
                  <span
                    className={cn(
                      "mt-0.5 size-1.5 rounded-full",
                      has ? (isSel ? "bg-accent" : "bg-faint") : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>

          {/* Selected day summary */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold">{relativeDayKey(selected, tz)}</span>
            <span className="text-sm font-bold tabular-nums">{money(dayTotal, currency)}</span>
          </div>

          {/* Selected day entries */}
          {dayExpenses.isLoading ? (
            <div className="h-16 animate-pulse rounded-xl bg-surface" />
          ) : dayItems.length === 0 ? (
            <p className="card px-4 py-3 text-sm text-muted">
              {catFilter ? `No ${catFor(catFilter)?.label} logged this day` : "No spend logged this day 👻"}
            </p>
          ) : (
            <div className="card divide-y divide-line">
              {dayItems.map((e) => (
                <ExpenseRow
                  key={e.id}
                  battleId={id}
                  expense={e}
                  category={catFor(e.category_id)}
                  currency={currency}
                />
              ))}
            </div>
          )}
    </div>
  );
}

function ExpenseRow({
  battleId,
  expense,
  category,
  currency,
}: {
  battleId: string;
  expense: Expense;
  category: Category | null;
  currency: string;
}) {
  const qc = useQueryClient();
  const categories = useCategories();
  const tz = useTimezone();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(expense.amount_cents / 100));
  const [categoryId, setCategoryId] = useState(expense.category_id);
  const [note, setNote] = useState(expense.note ?? "");
  // Derived rather than seeded into state: `tz` is undefined on the first render, so freezing the
  // initial value would pin the field to the device's zone even after the account's arrives.
  const [spentAtEdit, setSpentAtEdit] = useState<string | null>(null);
  const spentAt = spentAtEdit ?? datetimeLocalInTz(expense.spent_at, tz);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["analytics"] });
    qc.invalidateQueries({ queryKey: ["standings", battleId] });
    qc.invalidateQueries({ queryKey: ["battle", battleId] });
    qc.invalidateQueries({ queryKey: ["battles"] });
  }

  const save = useMutation({
    mutationFn: () =>
      api.updateExpense(expense.id, {
        amount_cents: Math.round(Number(amount || 0) * 100),
        category_id: categoryId,
        note: note.trim() || null,
        // The field holds a wall-clock time in the account's zone, not the device's — convert with
        // that zone, or an edit made while travelling would silently shift the expense.
        spent_at: spentAt ? datetimeLocalToUtc(spentAt, tz) : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setEditing(false);
    },
  });

  const del = useMutation({
    mutationFn: () => api.deleteExpense(expense.id),
    onSuccess: invalidate,
  });

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-surface-2"
      >
        <CategoryIcon name={category?.icon ?? "ellipsis"} className="size-5 shrink-0 text-faint" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{category?.label ?? "Other"}</div>
          {expense.note && <div className="truncate text-xs text-faint">{expense.note}</div>}
        </div>
        <div className="text-right">
          <div className="font-semibold tabular-nums">{money(expense.amount_cents, currency)}</div>
          <div className="text-xs text-faint">
            {formatTime(expense.spent_at, tz)}
          </div>
        </div>
      </button>
    );
  }

  const canSave = Number(amount) > 0 && !!categoryId && !save.isPending;

  return (
    <div className="space-y-3 px-4 py-3">
      <input
        className="input py-2"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="0.00"
      />
      <div className="grid grid-cols-5 gap-2">
        {categories.data?.map((c) => {
          const active = categoryId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border py-2 transition",
                active ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-muted",
              )}
            >
              <CategoryIcon name={c.icon} className="size-4" />
              <span className="text-[9px] font-semibold leading-none">{c.label}</span>
            </button>
          );
        })}
      </div>
      <input
        className="input py-2"
        value={note}
        maxLength={280}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
      />
      <label className="flex items-center justify-between gap-2 text-sm text-faint">
        When
        <input
          type="datetime-local"
          className="input w-auto flex-1 py-2 [color-scheme:dark]"
          value={spentAt}
          onChange={(e) => setSpentAtEdit(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => del.mutate()}
          disabled={del.isPending}
          className="btn-ghost px-3 py-2 text-sm text-danger"
        >
          <Trash2 className="size-4" /> Delete
        </button>
        <div className="flex-1" />
        <button onClick={() => setEditing(false)} className="btn-ghost px-3 py-2 text-sm">
          Cancel
        </button>
        <button onClick={() => save.mutate()} disabled={!canSave} className="btn-primary px-4 py-2 text-sm">
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function WinnerChip({
  result,
}: {
  result: {
    winner_user_id: string | null;
    snapshot: { standings: { userId: string; displayName: string }[]; isTie: boolean };
  };
}) {
  if (result.snapshot.isTie) return <span className="text-xs text-faint">Tie</span>;
  const w = result.snapshot.standings.find((s) => s.userId === result.winner_user_id);
  return <span className="text-xs font-semibold text-accent">{w ? `${w.displayName} 🏆` : "—"}</span>;
}

function BudgetEditor({ id, ym, current }: { id: string; ym: string; current: number | null }) {
  const qc = useQueryClient();
  const [val, setVal] = useState(current !== null ? String(Math.round(current / 100)) : "");
  const save = useMutation({
    mutationFn: () => api.setBudget(id, ym, { budget_cents: Math.round(Number(val || 0) * 100) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["battle", id] });
      qc.invalidateQueries({ queryKey: ["standings", id] });
    },
  });
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-sm text-faint">My budget</span>
      <input
        className="input flex-1 py-2"
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="1500"
      />
      <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary px-4 py-2 text-sm">
        {current !== null ? money(current) : "Set"}
      </button>
    </div>
  );
}
