import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Crown, Flame, TrendingUp } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { StandingsRows } from "../components/Standings";
import { RuleLine } from "../components/ui/rule-line";
import { Stamp } from "../components/ui/stamp";
import { Tape } from "../components/ui/tape";
import { TapeLabel } from "../components/ui/tape-label";
import { formatMonth, money } from "../lib/format";
import { useMe, useResult } from "../lib/queries";
import type { MonthlyResultSnapshot } from "../lib/types";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/battles/$id/results/$ym")({
  component: () => (
    <ClientOnly>
      <AppShell>
        <Showdown />
      </AppShell>
    </ClientOnly>
  ),
});

function Showdown() {
  const { id, ym } = Route.useParams();
  const me = useMe();
  const result = useResult(id, ym);

  if (result.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-paper-2" />;
  if (!result.data) return <p className="text-muted">This month hasn't been closed yet.</p>;

  const snap = result.data.snapshot;
  const meId = me.data?.id ?? null;
  const nameOf = (uid: string | null) => snap.standings.find((s) => s.userId === uid)?.displayName ?? "—";

  return (
    <div className="space-y-5">
      <header className="flex items-baseline gap-3 px-1 pt-2">
        <Link to="/battles/$id" params={{ id }} className="self-center text-faint" aria-label="Back to battle">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-mono text-base font-bold uppercase tracking-wide">{formatMonth(ym)}</h1>
        <span className="ml-auto font-mono text-xs text-muted">final</span>
      </header>

      {/* The settled slip — the stamp thunk is the app's second and last animation. */}
      <Tape className="pt-6">
        <div className="text-center">
          <Stamp thunk className="text-sm">
            Settled
          </Stamp>
          {snap.isTie ? (
            <>
              <p className="mt-4 font-mono text-xl font-bold uppercase tracking-wide">Dead heat</p>
              <p className="mt-1 text-sm text-muted">Nobody pulled ahead this month.</p>
            </>
          ) : snap.winnerUserId ? (
            <>
              <TapeLabel className="mt-5">Winner</TapeLabel>
              <p className="mt-1 flex items-center justify-center gap-2 font-mono text-2xl font-bold uppercase tracking-wide text-accent">
                <Crown className="size-6 text-gold" />
                {nameOf(snap.winnerUserId)}
              </p>
              {meId === snap.winnerUserId && <p className="mt-1 text-sm text-muted">That's you. Spent the least. 🏆</p>}
            </>
          ) : (
            <p className="mt-4 font-mono text-lg font-bold uppercase">No winner — nobody logged.</p>
          )}
        </div>
        <RuleLine className="my-4" />
        <TapeLabel>Final standings</TapeLabel>
        <StandingsRows snapshot={snap} meId={meId} currency={snap.currency} />
      </Tape>

      {/* Callouts */}
      {snap.callouts.length > 0 && (
        <Tape className="pt-5">
          <TapeLabel>The breakdown</TapeLabel>
          <div className="mt-2 space-y-2">
            {snap.callouts.map((c) => (
              <p key={c} className="rounded-lg bg-paper-2 px-3.5 py-2.5 text-sm text-ink">
                {c}
              </p>
            ))}
          </div>
        </Tape>
      )}

      {/* Category head-to-head */}
      {snap.categories.length > 0 && (
        <Tape className="pt-5">
          <TapeLabel>Category head-to-head</TapeLabel>
          <div className="mt-1 divide-y divide-dashed divide-rule">
            {snap.categories.map((cat) => (
              <CategoryRow key={cat.categoryId} cat={cat} snap={snap} nameOf={nameOf} />
            ))}
          </div>
        </Tape>
      )}

      {/* Daily race */}
      <DailyRace snap={snap} nameOf={nameOf} />

      {/* Trends */}
      <Trends snap={snap} nameOf={nameOf} />
    </div>
  );
}

function DailyRace({ snap, nameOf }: { snap: MonthlyResultSnapshot; nameOf: (uid: string | null) => string }) {
  const days = snap.trends.dailyTotals;
  if (days.length < 2) return null;

  const series = snap.standings.map((s, idx) => {
    let cum = 0;
    const points = days.map((d) => {
      cum += d.perUser.find((p) => p.userId === s.userId)?.totalCents ?? 0;
      return cum;
    });
    const isWinner = s.userId === snap.winnerUserId;
    return {
      userId: s.userId,
      points,
      final: cum,
      color: isWinner ? "var(--color-accent)" : "var(--color-muted)",
      opacity: isWinner ? 1 : Math.max(0.4, 1 - idx * 0.25),
    };
  });

  const max = Math.max(1, ...series.map((s) => s.final));
  const W = 320;
  const H = 140;
  const padX = 6;
  const padY = 10;
  const x = (i: number) => padX + (i / (days.length - 1)) * (W - padX * 2);
  const y = (v: number) => H - padY - (v / max) * (H - padY * 2);

  return (
    <Tape className="pt-5">
      <TapeLabel>Daily race</TapeLabel>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full">
        {series.map((s) => (
          <g key={s.userId} style={{ opacity: s.opacity }}>
            <polyline
              points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={x(days.length - 1)} cy={y(s.final)} r={3.5} fill={s.color} />
          </g>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s) => (
          <div key={s.userId} className="flex items-center gap-1.5 text-xs">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color, opacity: s.opacity }} />
            <span className="font-medium text-muted">{nameOf(s.userId)}</span>
            <span className="font-mono tabular-nums text-faint">{money(s.final, snap.currency)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-faint">Cumulative spend · lower line is winning</p>
    </Tape>
  );
}

function CategoryRow({
  cat,
  snap,
  nameOf,
}: {
  cat: MonthlyResultSnapshot["categories"][number];
  snap: MonthlyResultSnapshot;
  nameOf: (uid: string | null) => string;
}) {
  const max = Math.max(1, ...cat.perUser.map((p) => p.totalCents));
  return (
    <div className="py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{cat.label}</span>
        {cat.winnerUserId && (
          <span className="font-mono text-[10px] font-bold uppercase text-accent">{nameOf(cat.winnerUserId)} won</span>
        )}
      </div>
      <div className="space-y-1.5">
        {cat.perUser.map((p) => (
          <div key={p.userId} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-xs text-faint">{nameOf(p.userId)}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-2">
              <div
                className={cn("h-full rounded-full", p.userId === cat.winnerUserId ? "bg-accent" : "bg-faint")}
                style={{ width: `${(p.totalCents / max) * 100}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-muted">
              {money(p.totalCents, snap.currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Trends({ snap, nameOf }: { snap: MonthlyResultSnapshot; nameOf: (uid: string | null) => string }) {
  const t = snap.trends;
  if (!t.biggestSplurge && !t.mostExpensiveDay && t.winStreaks.length === 0) return null;
  return (
    <section className="space-y-2">
      <TapeLabel className="text-left">Trends</TapeLabel>
      <div className="grid grid-cols-2 gap-3">
        {t.biggestSplurge && (
          <StatCard icon={<Flame className="size-4 text-stamp" />} label="Biggest splurge">
            {money(t.biggestSplurge.amountCents, snap.currency)}
            <span className="block font-sans text-xs font-normal normal-case text-faint">
              {nameOf(t.biggestSplurge.userId)} · {t.biggestSplurge.label}
            </span>
          </StatCard>
        )}
        {t.mostExpensiveDay && (
          <StatCard icon={<TrendingUp className="size-4 text-gold" />} label="Priciest day">
            {money(t.mostExpensiveDay.totalCents, snap.currency)}
            <span className="block font-sans text-xs font-normal normal-case text-faint">
              {nameOf(t.mostExpensiveDay.userId)} · {t.mostExpensiveDay.date.slice(5)}
            </span>
          </StatCard>
        )}
        {t.winStreaks.map((w) => (
          <StatCard key={w.userId} icon={<Crown className="size-4 text-accent" />} label="Win streak">
            {w.months} {w.months === 1 ? "month" : "months"}
            <span className="block font-sans text-xs font-normal normal-case text-faint">{nameOf(w.userId)}</span>
          </StatCard>
        ))}
      </div>
    </section>
  );
}

function StatCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-4 py-3 shadow-paper">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-faint">
        {icon} {label}
      </div>
      <div className="mt-1 font-mono text-lg font-bold">{children}</div>
    </div>
  );
}
