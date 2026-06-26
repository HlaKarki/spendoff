import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy, LogOut } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { StandingsRows } from "../components/Standings";
import { api } from "../lib/api";
import { formatMonth, formatMonthShort, money } from "../lib/format";
import { useBattle, useMe, useResults, useStandings } from "../lib/queries";
import type { WinRule } from "../lib/types";
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
              <Link key={r.year_month} to="/battles/$id/results/$ym" params={{ id, ym: r.year_month }}>
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
