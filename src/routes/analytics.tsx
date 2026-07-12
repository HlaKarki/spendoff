import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { CategoryIcon } from "../components/icons";
import { EmptyState } from "../components/ui/empty-state";
import { RuleLine } from "../components/ui/rule-line";
import { Tape } from "../components/ui/tape";
import { TapeLabel } from "../components/ui/tape-label";
import { currentYearMonth, formatMonth, money, resolveCurrency } from "../lib/format";
import { useAnalytics, useMe } from "../lib/queries";
import type { Analytics } from "../lib/types";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/analytics")({
  component: () => (
    <ClientOnly>
      <AppShell>
        <AnalyticsScreen />
      </AppShell>
    </ClientOnly>
  ),
});

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthAbbr(ym: string): string {
  const m = Number(ym.split("-")[1]);
  return MONTH_ABBR[m - 1] ?? ym;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const WINDOW = 6;

function AnalyticsScreen() {
  const me = useMe();
  const currentYm = currentYearMonth(me.data?.timezone);
  const [selected, setSelected] = useState<string | null>(null);
  const ym = selected ?? currentYm;

  const analytics = useAnalytics({ year_month: ym, months: WINDOW });

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between px-1 pt-2">
        <h1 className="font-mono text-base font-bold uppercase tracking-wide">Stats</h1>
        <span className="font-mono text-xs text-muted">every battle</span>
      </header>

      {/* Month total + pager */}
      <Tape className="pt-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelected(shiftMonth(ym, -1))}
            className="flex size-8 items-center justify-center rounded-full text-faint transition hover:bg-paper-2 active:scale-95"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="font-mono text-sm font-bold uppercase tracking-[0.14em]">{formatMonth(ym)}</span>
          <button
            type="button"
            onClick={() => setSelected(shiftMonth(ym, 1))}
            disabled={ym >= currentYm}
            className="flex size-8 items-center justify-center rounded-full text-faint transition hover:bg-paper-2 active:scale-95 disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="mt-3 text-center">
          <TapeLabel>Month so far</TapeLabel>
          {analytics.isLoading ? (
            <div className="mx-auto mt-1 h-9 w-32 animate-pulse rounded-lg bg-paper-2" />
          ) : (
            <p className="mt-1 font-mono text-4xl font-bold tabular-nums">
              {money(analytics.data?.month_total_cents ?? 0, resolveCurrency(analytics.data?.base_currency))}
            </p>
          )}
          <MonthDelta data={analytics.data} ym={ym} />
        </div>
      </Tape>

      {analytics.isError ? (
        <Tape className="pt-5">
          <EmptyState title="Couldn't load your stats.">Try again in a moment.</EmptyState>
        </Tape>
      ) : (
        <>
          <MonthlyTrend
            data={analytics.data}
            loading={analytics.isLoading}
            selected={ym}
            currentYm={currentYm}
            onSelect={setSelected}
          />
          <CategoryBreakdown data={analytics.data} loading={analytics.isLoading} ym={ym} />
        </>
      )}
    </div>
  );
}

function MonthDelta({ data, ym }: { data?: Analytics; ym: string }) {
  if (!data) return null;
  const prev = data.monthly.find((m) => m.year_month === shiftMonth(ym, -1));
  const cur = data.month_total_cents;
  if (!prev || prev.total_cents === 0) return <p className="mt-1 text-sm text-faint">Total spent</p>;
  const delta = (cur - prev.total_cents) / prev.total_cents;
  const up = cur >= prev.total_cents;
  return (
    <p className="mt-1 text-sm text-faint">
      <span className={cn("font-mono font-semibold", up ? "text-stamp" : "text-accent")}>
        {up ? "↑" : "↓"} {Math.abs(Math.round(delta * 100))}%
      </span>{" "}
      vs {monthAbbr(prev.year_month)}
    </p>
  );
}

function MonthlyTrend({
  data,
  loading,
  selected,
  currentYm,
  onSelect,
}: {
  data?: Analytics;
  loading: boolean;
  selected: string;
  currentYm: string;
  onSelect: (ym: string) => void;
}) {
  if (loading) return <div className="h-44 animate-pulse rounded-2xl bg-paper-2" />;
  if (!data || data.monthly.length === 0) return null;

  const monthly = data.monthly;
  const max = Math.max(1, ...monthly.map((m) => m.total_cents));
  // Every total the endpoint returns is already in this — mixed-currency months included.
  const currency = resolveCurrency(data.base_currency);

  return (
    <Tape className="pt-5">
      <TapeLabel>Last {monthly.length} months</TapeLabel>
      <div className="mt-3 flex h-32 items-end gap-2">
        {monthly.map((m) => {
          const h = (m.total_cents / max) * 100;
          const isSel = m.year_month === selected;
          const future = m.year_month > currentYm;
          return (
            <button
              type="button"
              key={m.year_month}
              disabled={future}
              onClick={() => onSelect(m.year_month)}
              className="group flex h-full flex-1 items-end disabled:cursor-default"
              aria-label={`${formatMonth(m.year_month)}: ${money(m.total_cents, currency)}`}
            >
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${Math.max(3, h)}%`,
                  backgroundColor: isSel ? "var(--color-accent)" : "var(--color-muted)",
                  opacity: isSel ? 1 : 0.4,
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {monthly.map((m) => (
          <div
            key={m.year_month}
            className={cn(
              "flex-1 text-center font-mono text-[10px] font-semibold uppercase",
              m.year_month === selected ? "text-accent" : "text-faint",
            )}
          >
            {monthAbbr(m.year_month)}
          </div>
        ))}
      </div>
    </Tape>
  );
}

function CategoryBreakdown({ data, loading, ym }: { data?: Analytics; loading: boolean; ym: string }) {
  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-paper-2" />;
  if (!data) return null;

  const cats = data.by_category;
  if (cats.length === 0) {
    return (
      <Tape className="pt-5">
        <TapeLabel>By category</TapeLabel>
        <EmptyState title={`Nothing logged in ${formatMonth(ym)}.`}>A blank slip is the best kind.</EmptyState>
      </Tape>
    );
  }

  const max = Math.max(1, ...cats.map((c) => c.total_cents));
  const currency = resolveCurrency(data.base_currency);
  const total = data.month_total_cents;

  return (
    <Tape className="pt-5">
      <TapeLabel>By category</TapeLabel>
      <RuleLine />
      <div className="space-y-3.5">
        {cats.map((c) => {
          const pct = total ? Math.round((c.total_cents / total) * 100) : 0;
          return (
            <div key={c.category_id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <CategoryIcon name={c.icon} className="size-4 text-faint" />
                  <span className="font-medium">{c.label}</span>
                </span>
                <span className="font-mono tabular-nums">
                  <span className="font-semibold">{money(c.total_cents, currency)}</span>
                  <span className="ml-1.5 text-xs text-faint">{pct}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-paper-2">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(2, (c.total_cents / max) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Tape>
  );
}
