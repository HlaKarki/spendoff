import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Swords } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { StandingsRows } from "../components/Standings";
import { formatMonth } from "../lib/format";
import { useBattles, useMe, useStandings } from "../lib/queries";

export const Route = createFileRoute("/")({
  component: () => (
    <ClientOnly>
      <Dashboard />
    </ClientOnly>
  ),
});

function Dashboard() {
  return (
    <AppShell>
      <DashboardBody />
    </AppShell>
  );
}

function DashboardBody() {
  const me = useMe();
  const battles = useBattles();

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <p className="text-sm text-faint">Hey {me.data?.display_name} 👋</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">This month's battles</h1>
      </header>

      {battles.isLoading && <div className="h-32 animate-pulse rounded-2xl bg-surface" />}

      {battles.data?.length === 0 && (
        <div className="card flex flex-col items-center px-6 py-12 text-center">
          <Swords className="size-10 text-accent" />
          <p className="mt-4 text-lg font-semibold">No battles yet</p>
          <p className="mt-1 text-sm text-muted">Create one and invite someone to spend less than you.</p>
          <Link to="/battles" className="btn-primary mt-5 px-6 py-3">
            Create a battle
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {battles.data?.map((b) => (
          <BattleStandingsCard
            key={b.id}
            id={b.id}
            name={b.name}
            currency={b.currency}
            memberCount={b.member_count}
            meId={me.data?.id ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function BattleStandingsCard({
  id,
  name,
  currency,
  memberCount,
  meId,
}: {
  id: string;
  name: string;
  currency: string;
  memberCount: number;
  meId: string | null;
}) {
  const standings = useStandings(id);

  return (
    <Link to="/battles/$id" params={{ id }} className="block">
      <div className="card overflow-hidden transition active:scale-[0.99]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="font-semibold">{name}</div>
            <div className="text-xs text-faint">
              {standings.data ? formatMonth(standings.data.year_month) : "—"} · {memberCount}{" "}
              {memberCount === 1 ? "player" : "players"}
            </div>
          </div>
          <ChevronRight className="size-5 text-faint" />
        </div>
        <div className="p-4">
          {standings.isLoading ? (
            <div className="h-20 animate-pulse rounded-xl bg-surface-2" />
          ) : standings.data ? (
            <StandingsRows snapshot={standings.data.result} meId={meId} currency={currency} />
          ) : (
            <p className="text-sm text-faint">Couldn't load standings.</p>
          )}
        </div>
      </div>
    </Link>
  );
}
