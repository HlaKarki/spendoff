import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, LogOut, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/AppShell";
import { CategoryPicker } from "../components/CategoryPicker";
import { ClientOnly } from "../components/ClientOnly";
import { CategoryIcon } from "../components/icons";
import { StandingsRows } from "../components/Standings";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LineItem } from "../components/ui/line-item";
import { Money } from "../components/ui/money";
import { RuleLine } from "../components/ui/rule-line";
import { Stamp } from "../components/ui/stamp";
import { SwitchIndicator } from "../components/ui/switch";
import { Tape } from "../components/ui/tape";
import { TapeLabel } from "../components/ui/tape-label";
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
  monthDays,
  relativeDayKey,
  resolveCurrency,
  toMajor,
  toMinor,
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
import type { BattleMember, Category, Expense, MonthlyResultSnapshot, WinRule } from "../lib/types";
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

/* One long slip, ordered by how often each section matters (HLA-92 IA decision):
 * standings → gap → your tape → past months → setup. Setup (win rule, players
 * and sharing, invite, leave) is day-one configuration; it lives at the bottom. */
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

  if (detail.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-paper-2" />;
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
      <header className="flex items-baseline gap-3 px-1 pt-2">
        <Link to="/battles" className="self-center text-faint" aria-label="Back to battles">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 truncate font-mono text-base font-bold uppercase tracking-wide">{b.name}</h1>
        <span className="ml-auto shrink-0 font-mono text-xs text-muted">{b.currency}</span>
      </header>

      {/* Live standings */}
      <Tape className="pt-5">
        <div className="flex items-baseline justify-between">
          <TapeLabel className="text-left">{formatMonth(ym)}</TapeLabel>
          <TapeLabel className="text-right text-accent">live</TapeLabel>
        </div>
        <RuleLine />
        {standings.data ? (
          <>
            <StandingsRows snapshot={standings.data.result} meId={me.data?.id ?? null} currency={b.currency} />
            <GapLine snapshot={standings.data.result} meId={me.data?.id ?? null} currency={b.currency} />
          </>
        ) : (
          <div className="h-24 animate-pulse rounded-lg bg-paper-2" />
        )}
        {standings.data?.result.callouts.slice(0, 1).map((c) => (
          <p key={c} className="mt-2 rounded-lg bg-paper-2 px-3 py-2 text-sm text-muted">
            {c}
          </p>
        ))}
      </Tape>

      {/* Your spend — personal, so it reads in YOUR base currency, not the battle's. */}
      <MySpend
        id={id}
        // oxlint-disable-next-line no-array-sort -- Array.from creates a fresh array, safe to sort in place
        months={Array.from(new Set([ym, ...(results.data?.map((r) => r.year_month) ?? [])])).sort()}
      />

      {/* Past results */}
      {results.data && results.data.length > 0 && (
        <Tape className="pt-5">
          <TapeLabel>Past months</TapeLabel>
          <div className="mt-1 divide-y divide-dashed divide-rule">
            {results.data.map((r) => (
              <Link
                key={r.year_month}
                to="/battles/$id/results/$ym"
                params={{ id, ym: r.year_month }}
                className="flex items-center justify-between gap-3 py-2.5 transition active:opacity-70"
              >
                <span className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-semibold uppercase">{formatMonthShort(r.year_month)}</span>
                  <Stamp className="text-[9px]">Settled</Stamp>
                </span>
                <WinnerChip result={r} />
              </Link>
            ))}
          </div>
        </Tape>
      )}

      {/* Setup — day-one configuration lives at the bottom of the slip. */}
      <Tape className="pt-5">
        <TapeLabel>Setup</TapeLabel>

        <p className="mt-3 mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          Win rule {!isOwner && "(owner sets this)"}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {RULES.map((r) => (
            <button
              key={r.value}
              disabled={!isOwner || setRule.isPending}
              onClick={() => setRule.mutate(r.value)}
              className={cn(
                "rounded-lg border px-2 py-2.5 text-xs font-semibold transition",
                detail.data!.win_rule === r.value ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-muted",
                !isOwner && "opacity-60",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        {detail.data.win_rule === "most_under_budget" && (
          <BudgetEditor id={id} ym={ym} current={detail.data.my_budget_cents} currency={detail.data.battle.currency} />
        )}

        <RuleLine className="my-4" />
        <Players id={id} members={detail.data.members} meId={me.data?.id ?? null} />

        <RuleLine className="my-4" />
        <button onClick={copyCode} className="flex w-full items-center justify-between py-1 text-left">
          <span>
            <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
              Invite code
            </span>
            <span data-testid="invite-code" className="font-mono text-lg font-bold tracking-widest">
              {b.invite_code}
            </span>
          </span>
          {copied ? <Check className="size-5 text-accent" /> : <Copy className="size-5 text-faint" />}
        </button>

        <RuleLine className="my-4" />
        <Button variant="ghost" full onClick={() => leave.mutate()} disabled={leave.isPending} className="text-stamp">
          <LogOut className="size-4" /> Leave battle
        </Button>
      </Tape>
    </div>
  );
}

/** The number the whole screen is really about: how far off the lead you are. */
function GapLine({
  snapshot,
  meId,
  currency,
}: {
  snapshot: MonthlyResultSnapshot;
  meId: string | null;
  currency: string;
}) {
  const mine = snapshot.standings.find((s) => s.userId === meId);
  if (!mine || mine.rank === 1 || snapshot.standings.length < 2) return null;
  return (
    <>
      <RuleLine />
      <LineItem
        what={<span className="font-mono text-xs font-semibold uppercase tracking-wide text-muted">Gap to leader</span>}
        amount={<Money minor={mine.totalCents - snapshot.standings[0].totalCents} currency={currency} />}
      />
    </>
  );
}

/**
 * The players list, and the one place sharing is turned on or off.
 *
 * Sharing is per battle by design: you might be happy to open your log to your partner's league and
 * not to your coworkers'. So the toggle lives here, on the battle, rather than once in Settings.
 */
function Players({ id, members, meId }: { id: string; members: BattleMember[]; meId: string | null }) {
  const qc = useQueryClient();
  const mine = members.find((m) => m.user_id === meId);

  const setSharing = useMutation({
    mutationFn: (share: boolean) => api.setSharing(id, share),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["battle", id] }),
  });

  return (
    <div>
      <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Players</p>
      <div className="divide-y divide-dashed divide-rule">
        {members.map((m) => {
          const isMe = m.user_id === meId;
          const label = (
            <span className="text-sm font-medium">
              {m.display_name}
              {isMe && <span className="ml-2 font-mono text-[10px] uppercase text-faint">you</span>}
            </span>
          );

          // Someone else who's opted in: their log is one tap away.
          if (!isMe && m.share_history) {
            return (
              <Link
                key={m.user_id}
                to="/battles/$id/members/$userId"
                params={{ id, userId: m.user_id }}
                className="flex items-center justify-between py-2.5 transition active:opacity-70"
              >
                {label}
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-accent">
                  View log
                  <ChevronRight className="size-3.5" />
                </span>
              </Link>
            );
          }

          return (
            <div key={m.user_id} className="flex items-center justify-between py-2.5">
              {label}
              {/* Someone else's private log states itself plainly — it isn't a locked door to rattle. */}
              {!isMe && <span className="font-mono text-[10px] uppercase text-faint">Log private</span>}
              {isMe && <span className="font-mono text-[10px] uppercase text-faint">{m.role}</span>}
            </div>
          );
        })}
      </div>

      {mine && (
        <button
          onClick={() => setSharing.mutate(!mine.share_history)}
          disabled={setSharing.isPending}
          className="mt-2 flex w-full items-center justify-between gap-3 rounded-lg border border-rule px-3.5 py-3 text-left"
        >
          <span>
            <span className="block text-sm font-medium">Share my log with this battle</span>
            <span className="block text-xs text-faint">
              {mine.share_history
                ? "Players here can see what you spent on, and when — never your notes."
                : "Off. Only your totals show up in the standings."}
            </span>
          </span>
          <SwitchIndicator on={mine.share_history} />
        </button>
      )}
    </div>
  );
}

function chipParts(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  // The weekday of a calendar date is a property of the date, not of any zone — build and read it
  // in UTC so the chip can't drift with the device.
  const date = new Date(Date.UTC(y, m - 1, d));
  return { weekday: date.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" }), day: d };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function MySpend({ id, months }: { id: string; months: string[] }) {
  const [sel, setSel] = useState(months[months.length - 1]);
  const idx = Math.max(0, months.indexOf(sel));
  const ym = months[idx];
  return (
    <Tape className="pt-5">
      <div className="flex items-center justify-between">
        <TapeLabel className="text-left">Your tape</TapeLabel>
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
            <span className="min-w-[5.5rem] text-center font-mono text-xs font-semibold uppercase">
              {formatMonthShort(ym)}
            </span>
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
      <MonthSpend key={ym} id={id} ym={ym} />
    </Tape>
  );
}

/**
 * The caller's own spend for the month — a personal drill-down, not the scoreboard. It's therefore
 * denominated in the caller's base currency, not the battle's; the battle's currency belongs to the
 * standings, where members are compared against one another.
 */
function MonthSpend({ id, ym }: { id: string; ym: string }) {
  const me = useMe();
  const tz = me.data?.timezone;
  const summary = useAnalytics({ year_month: ym, months: 1 });
  const categories = useCategories();
  const catFor = (categoryId: string) => categories.data?.find((c) => c.id === categoryId) ?? null;
  const [catFilter, setCatFilter] = useState<string | null>(null);

  const daysWithSpend = useMemo(() => new Set(summary.data?.daily.map((d) => d.date) ?? []), [summary.data]);
  const days = useMemo(() => monthDays(ym, tz, daysWithSpend), [ym, tz, daysWithSpend]);

  const todayKey = `${currentYearMonth(tz)}-${pad2(currentDayOfMonth(tz))}`;
  const [selected, setSelected] = useState(days.includes(todayKey) ? todayKey : days[days.length - 1]);

  // Only the selected day's rows are fetched (server resolves the day in the user's tz).
  const dayExpenses = useDayExpenses(selected, catFilter ?? undefined);
  // oxlint-disable-next-line no-array-sort -- .slice() already copies before sorting
  const dayItems = (dayExpenses.data ?? []).slice().sort((a, b) => b.spent_at.localeCompare(a.spent_at));
  // Sum the frozen base-currency amounts, not the raw ones: a day holding a $12 lunch and a €12
  // dinner has a total, but it isn't 24 of anything.
  const dayTotal = dayItems.reduce((s, e) => s + e.base_amount_cents, 0);

  // Month/category totals come from the cheap aggregate, not a full-month row download.
  const monthTotal = catFilter
    ? (summary.data?.by_category.find((c) => c.category_id === catFilter)?.total_cents ?? 0)
    : (summary.data?.month_total_cents ?? 0);

  // These two are MY spend, not the battle's scoreboard — so they belong in my base currency. The
  // battle's own currency applies to the standings, where members are compared against each other.
  const myCurrency = resolveCurrency(summary.data?.base_currency ?? me.data?.base_currency);

  const stripRef = useRef<HTMLDivElement | null>(null);
  const selRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const c = stripRef.current;
    const el = selRef.current;
    if (c && el) c.scrollLeft = el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2;
  }, [summary.isLoading]);

  if (summary.isLoading) return <div className="mt-3 h-28 animate-pulse rounded-lg bg-paper-2" />;

  return (
    <div className="mt-3 space-y-3">
      {/* Category filter */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setCatFilter(null)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            catFilter === null ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-muted",
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
              catFilter === c.id ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-muted",
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
          <span className="font-mono font-semibold text-muted">{money(monthTotal, myCurrency)}</span>
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
                "flex min-w-[3rem] shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2 py-2 transition",
                isSel ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-muted",
              )}
            >
              <span className="font-mono text-[10px] font-semibold uppercase">{weekday}</span>
              <span className="font-mono text-base font-bold leading-none tabular-nums">{day}</span>
              <span
                className={cn(
                  "mt-0.5 size-1.5 rounded-full",
                  has ? (isSel ? "bg-paper" : "bg-faint") : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Selected day summary */}
      <LineItem
        what={<span className="text-sm font-semibold">{relativeDayKey(selected, tz)}</span>}
        amount={<Money minor={dayTotal} currency={myCurrency} className="text-sm" />}
      />

      {/* Selected day entries */}
      {dayExpenses.isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-paper-2" />
      ) : dayItems.length === 0 ? (
        <p className="rounded-lg bg-paper-2 px-3.5 py-3 text-sm text-muted">
          {catFilter ? `No ${catFor(catFilter)?.label} logged this day` : "No spend logged this day 👻"}
        </p>
      ) : (
        <div className="divide-y divide-dashed divide-rule">
          {dayItems.map((e) => (
            <ExpenseRow key={e.id} battleId={id} expense={e} category={catFor(e.category_id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// A row is rendered in the currency it was SPENT in — never the battle's. The two are only the same
// by coincidence, and labelling a CA$100 dinner as "$100" would be a lie the user can't detect.
function ExpenseRow({
  battleId,
  expense,
  category,
}: {
  battleId: string;
  expense: Expense;
  category: Category | null;
}) {
  const qc = useQueryClient();
  const categories = useCategories();
  const tz = useTimezone();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(toMajor(expense.amount_cents, expense.currency)));
  const converted = expense.currency !== expense.base_currency;
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
        // Parsed in the expense's own currency — a "1000" typed against a ¥ expense is ¥1000, and
        // scaling it by a hard-coded 100 would book a hundredfold error.
        amount_cents: toMinor(Number(amount || 0), expense.currency),
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
        className="flex w-full items-center gap-3 py-2.5 text-left transition active:opacity-70"
      >
        <CategoryIcon name={category?.icon ?? "ellipsis"} className="size-5 shrink-0 text-faint" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{category?.label ?? "Other"}</div>
          {expense.note && <div className="truncate text-xs text-faint">{expense.note}</div>}
        </div>
        <div className="text-right">
          <Money minor={expense.amount_cents} currency={expense.currency} className="text-sm" />
          {converted ? (
            // What it actually counted as. The rate behind it is one tap away, in the edit view —
            // no room for it here, and a title= tooltip is invisible on a phone.
            <div className="font-mono text-[10px] uppercase text-faint">
              {money(expense.base_amount_cents, expense.base_currency)} · {formatTime(expense.spent_at, tz)}
            </div>
          ) : (
            <div className="font-mono text-[10px] uppercase text-faint">{formatTime(expense.spent_at, tz)}</div>
          )}
        </div>
      </button>
    );
  }

  const canSave = Number(amount) > 0 && !!categoryId && !save.isPending;

  return (
    <div className="space-y-3 py-3">
      <Input
        className="py-2 font-mono"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="0.00"
        aria-label={`Amount in ${expense.currency}`}
      />
      {converted && (
        // The whole point of freezing the rate onto the row: this line can state exactly what the
        // number was converted at, and when — and it will still say the same thing next year.
        <p className="text-xs text-faint">
          Counted as {money(expense.base_amount_cents, expense.base_currency)} — 1 {expense.currency} ={" "}
          {expense.rate_to_base.toFixed(4)} {expense.base_currency}
          {expense.rate_date ? ` on ${expense.rate_date}` : ""}
        </p>
      )}
      <CategoryPicker
        compact
        categories={categories.data}
        value={categoryId}
        onChange={setCategoryId}
        aria-label="Expense category"
      />
      <Input
        className="py-2"
        value={note}
        maxLength={280}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
      />
      <label className="flex items-center justify-between gap-2 text-sm text-faint">
        When
        <Input
          type="datetime-local"
          className="w-auto flex-1 py-2 font-mono text-xs"
          value={spentAt}
          onChange={(e) => setSpentAtEdit(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => del.mutate()} disabled={del.isPending} className="text-stamp">
          <Trash2 className="size-4" /> Delete
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={!canSave}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
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
  if (result.snapshot.isTie) return <span className="font-mono text-[10px] uppercase text-faint">Tie</span>;
  const w = result.snapshot.standings.find((s) => s.userId === result.winner_user_id);
  return <span className="font-mono text-xs font-bold uppercase text-accent">{w ? w.displayName : "—"}</span>;
}

/**
 * A budget is denominated in the BATTLE's currency — it's only ever compared against a standings
 * total, which is already converted into that currency. So it needs no conversion of its own, and
 * `currency` here is the battle's, not the member's.
 */
function BudgetEditor({
  id,
  ym,
  current,
  currency,
}: {
  id: string;
  ym: string;
  current: number | null;
  currency: string;
}) {
  const qc = useQueryClient();
  const [val, setVal] = useState(current !== null ? String(Math.round(toMajor(current, currency))) : "");
  const save = useMutation({
    mutationFn: () => api.setBudget(id, ym, { budget_cents: toMinor(Number(val || 0), currency) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["battle", id] });
      qc.invalidateQueries({ queryKey: ["standings", id] });
    },
  });
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-sm text-faint">My budget</span>
      <Input
        className="flex-1 py-2 font-mono"
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="1500"
        aria-label={`Monthly budget in ${currency}`}
      />
      <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} className="font-mono">
        {current !== null ? money(current, currency) : "Set"}
      </Button>
    </div>
  );
}
