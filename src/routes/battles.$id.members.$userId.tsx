import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { CategoryIcon } from "../components/icons";
import { Money } from "../components/ui/money";
import { RuleLine } from "../components/ui/rule-line";
import { Tape } from "../components/ui/tape";
import { TapeLabel } from "../components/ui/tape-label";
import { currentYearMonth, dayInTz, formatMonthShort, formatTime, money, relativeDayKey } from "../lib/format";
import { useCategories, useMemberHistory, useMe, useTimezone } from "../lib/queries";
import type { SharedExpense } from "../lib/types";

export const Route = createFileRoute("/battles/$id/members/$userId")({
  component: () => (
    <ClientOnly>
      <AppShell>
        <MemberLog />
      </AppShell>
    </ClientOnly>
  ),
});

/**
 * A read-only view of another player's log for one month, shown only while they've opted in for this
 * battle. There is no edit affordance anywhere in here, and no note ever arrives from the server.
 *
 * Sharing can be revoked mid-visit, so this screen treats `shared: false` as a normal answer rather
 * than an error — flip the toggle off and the very next month you page to says "private".
 */
function MemberLog() {
  const { id, userId } = Route.useParams();
  const me = useMe();
  const tz = useTimezone();
  const [offset, setOffset] = useState(0); // months back from the current one
  const ym = monthsAgo(offset, tz);

  const history = useMemberHistory(id, userId, ym);
  const categories = useCategories();
  const catFor = (categoryId: string) => categories.data?.find((c) => c.id === categoryId) ?? null;

  const name = history.data?.display_name ?? "";
  const rows = history.data?.expenses ?? [];

  // Their spend, in the currency each expense was actually made in. The totals line uses the frozen
  // base amounts, because a month holding a $12 lunch and a €12 dinner has a total that is 24 of
  // nothing — and that base currency is theirs, so it's labelled with theirs, not the viewer's.
  const theirBase = rows[0]?.base_currency ?? me.data?.base_currency ?? "USD";
  const total = rows.reduce((s, e) => s + e.base_amount_cents, 0);

  const byDay = groupByDay(rows, tz);

  return (
    <div className="space-y-5">
      <header className="flex items-baseline gap-3 px-1 pt-2">
        <Link to="/battles/$id" params={{ id }} className="self-center text-faint" aria-label="Back to battle">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 truncate font-mono text-base font-bold uppercase tracking-wide">{name || "Log"}</h1>
        <span className="ml-auto shrink-0 font-mono text-[10px] uppercase text-faint">shared log</span>
      </header>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset(offset + 1)} className="text-faint" aria-label="Previous month">
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-[5.5rem] text-center font-mono text-xs font-semibold uppercase">
            {formatMonthShort(ym)}
          </span>
          <button
            onClick={() => setOffset(offset - 1)}
            disabled={offset === 0}
            className="text-faint disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        {history.data?.shared && rows.length > 0 && <Money minor={total} currency={theirBase} className="text-sm" />}
      </div>

      {history.isLoading ? (
        <div className="h-28 animate-pulse rounded-lg bg-paper-2" />
      ) : !history.data?.shared ? (
        <Tape className="pt-5">
          <div className="flex items-center gap-3 text-sm text-muted">
            <Lock className="size-4 shrink-0 text-faint" />
            <span>{name || "This player"} keeps their log private.</span>
          </div>
        </Tape>
      ) : rows.length === 0 ? (
        <Tape className="pt-5">
          <p className="text-sm text-muted">Nothing logged in {formatMonthShort(ym)}.</p>
        </Tape>
      ) : (
        <div className="space-y-4">
          {byDay.map(([day, items]) => (
            <Tape key={day} className="pt-5">
              <TapeLabel>{relativeDayKey(day, tz)}</TapeLabel>
              <div className="mt-1 divide-y divide-dashed divide-rule">
                {items.map((e) => {
                  const category = catFor(e.category_id);
                  const converted = e.currency !== e.base_currency;
                  return (
                    <div key={e.id} className="flex items-center gap-3 py-2.5">
                      <CategoryIcon name={category?.icon ?? "ellipsis"} className="size-5 shrink-0 text-faint" />
                      {/* Category only. There is no note here to render — the server never sends one. */}
                      <div className="min-w-0 flex-1 truncate text-sm font-medium">{category?.label ?? "Other"}</div>
                      <div className="text-right">
                        <Money minor={e.amount_cents} currency={e.currency} className="text-sm" />
                        <div className="font-mono text-[10px] uppercase text-faint">
                          {converted && `${money(e.base_amount_cents, e.base_currency)} · `}
                          {formatTime(e.spent_at, tz)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <RuleLine />
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xs font-bold uppercase">{relativeDayKey(day, tz)}</span>
                <Money
                  minor={items.reduce((s, e) => s + e.base_amount_cents, 0)}
                  currency={theirBase}
                  className="text-sm"
                />
              </div>
            </Tape>
          ))}
        </div>
      )}
    </div>
  );
}

// The month `offset` months before the current one, walked back from the viewer's own current month
// so the arrows agree with every other month label in the app.
function monthsAgo(offset: number, tz: string | undefined): string {
  const [y, m] = currentYearMonth(tz).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Newest day first, and newest expense first within a day — the order you'd scroll a log in.
function groupByDay(rows: SharedExpense[], tz: string | undefined): [string, SharedExpense[]][] {
  const days = new Map<string, SharedExpense[]>();
  for (const e of rows) {
    const day = dayInTz(e.spent_at, tz);
    const list = days.get(day);
    if (list) list.push(e);
    else days.set(day, [e]);
  }
  return (
    [...days.entries()]
      // oxlint-disable-next-line no-array-sort -- the spread already made a fresh array
      .sort((a, b) => b[0].localeCompare(a[0]))
      // oxlint-disable-next-line no-array-sort -- .slice() copies before sorting
      .map(([day, items]) => [day, items.slice().sort((a, b) => b.spent_at.localeCompare(a.spent_at))])
  );
}
