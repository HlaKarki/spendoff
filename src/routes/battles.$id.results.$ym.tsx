import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Crown, Flame, TrendingUp } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { StandingsRows } from "../components/Standings";
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

  if (result.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-surface" />;
  if (!result.data) return <p className="text-muted">This month hasn't been closed yet.</p>;

  const snap = result.data.snapshot;
  const meId = me.data?.id ?? null;
  const nameOf = (uid: string | null) => snap.standings.find((s) => s.userId === uid)?.displayName ?? "—";

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3 pt-2">
        <Link to="/battles/$id" params={{ id }} className="text-faint">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">{formatMonth(ym)}</h1>
      </header>

      {/* Winner banner */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-b from-accent/15 to-transparent px-6 py-8 text-center">
          {snap.isTie ? (
            <>
              <div className="text-4xl">🤝</div>
              <p className="mt-2 font-display text-2xl font-black">Dead heat</p>
              <p className="text-sm text-muted">Nobody pulled ahead this month.</p>
            </>
          ) : snap.winnerUserId ? (
            <>
              <Crown className="mx-auto size-10 text-gold" />
              <p className="mt-2 text-sm uppercase tracking-wide text-faint">Winner</p>
              <p className="font-display text-3xl font-black text-accent">{nameOf(snap.winnerUserId)}</p>
              {meId === snap.winnerUserId && <p className="mt-1 text-sm text-muted">That's you. Spent the least. 🏆</p>}
            </>
          ) : (
            <p className="font-display text-xl font-bold">No winner — nobody logged.</p>
          )}
        </div>
      </div>

      {/* Standings */}
      <section className="space-y-3">
        <h2 className="label">Final standings</h2>
        <StandingsRows snapshot={snap} meId={meId} currency={snap.currency} />
      </section>

      {/* Callouts */}
      {snap.callouts.length > 0 && (
        <section className="space-y-2">
          <h2 className="label">The breakdown</h2>
          <div className="space-y-2">
            {snap.callouts.map((c, i) => (
              <p key={i} className="rounded-xl bg-surface px-4 py-3 text-sm text-fg">
                {c}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Category head-to-head */}
      {snap.categories.length > 0 && (
        <section className="space-y-2">
          <h2 className="label">Category head-to-head</h2>
          <div className="card divide-y divide-line">
            {snap.categories.map((cat) => (
              <CategoryRow key={cat.categoryId} cat={cat} snap={snap} nameOf={nameOf} />
            ))}
          </div>
        </section>
      )}

      {/* Trends */}
      <Trends snap={snap} nameOf={nameOf} />
    </div>
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
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{cat.label}</span>
        {cat.winnerUserId && <span className="text-xs font-semibold text-accent">{nameOf(cat.winnerUserId)} won</span>}
      </div>
      <div className="space-y-1.5">
        {cat.perUser.map((p) => (
          <div key={p.userId} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-xs text-faint">{nameOf(p.userId)}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn("h-full rounded-full", p.userId === cat.winnerUserId ? "bg-accent" : "bg-faint")}
                style={{ width: `${(p.totalCents / max) * 100}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted">{money(p.totalCents, snap.currency)}</span>
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
      <h2 className="label">Trends</h2>
      <div className="grid grid-cols-2 gap-3">
        {t.biggestSplurge && (
          <StatCard icon={<Flame className="size-4 text-danger" />} label="Biggest splurge">
            {money(t.biggestSplurge.amountCents, snap.currency)}
            <span className="block text-xs font-normal text-faint">{nameOf(t.biggestSplurge.userId)} · {t.biggestSplurge.label}</span>
          </StatCard>
        )}
        {t.mostExpensiveDay && (
          <StatCard icon={<TrendingUp className="size-4 text-gold" />} label="Priciest day">
            {money(t.mostExpensiveDay.totalCents, snap.currency)}
            <span className="block text-xs font-normal text-faint">{nameOf(t.mostExpensiveDay.userId)} · {t.mostExpensiveDay.date.slice(5)}</span>
          </StatCard>
        )}
        {t.winStreaks.map((w) => (
          <StatCard key={w.userId} icon={<Crown className="size-4 text-accent" />} label="Win streak">
            {w.months} {w.months === 1 ? "month" : "months"}
            <span className="block text-xs font-normal text-faint">{nameOf(w.userId)}</span>
          </StatCard>
        ))}
      </div>
    </section>
  );
}

function StatCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-faint">
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-lg font-bold">{children}</div>
    </div>
  );
}
