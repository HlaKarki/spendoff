import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Swords, UserPlus } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { StandingsRows } from "../components/Standings";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { Field } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { RuleLine } from "../components/ui/rule-line";
import { Tape } from "../components/ui/tape";
import { api, ApiError } from "../lib/api";
import { formatMonth, resolveCurrency } from "../lib/format";
import { useBaseCurrency, useBattles, useCurrencies, useMe, useStandings } from "../lib/queries";

export const Route = createFileRoute("/battles/")({
  component: () => (
    <ClientOnly>
      <AppShell>
        <BattlesScreen />
      </AppShell>
    </ClientOnly>
  ),
});

type Sheet = "none" | "create" | "join";

function BattlesScreen() {
  const battles = useBattles();
  const me = useMe();
  const [sheet, setSheet] = useState<Sheet>("none");

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between px-1 pt-2">
        <h1 className="font-mono text-base font-bold uppercase tracking-wide">Battles</h1>
        {battles.data && battles.data.length > 0 && (
          <span className="font-mono text-xs text-muted">{battles.data.length} running</span>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => setSheet("create")}>
          <Plus className="size-4" /> Create
        </Button>
        <Button variant="outline" onClick={() => setSheet("join")}>
          <UserPlus className="size-4" /> Join
        </Button>
      </div>

      {battles.isLoading && <div className="h-32 animate-pulse rounded-2xl bg-paper-2" />}

      {battles.data?.length === 0 && (
        <Tape className="pt-6">
          <Swords className="mx-auto size-8 text-accent" />
          <EmptyState title="Start your first battle.">Create one and share the invite code.</EmptyState>
        </Tape>
      )}

      {/* The digest: this tab absorbed the old dashboard, so each battle shows its month's
          standings right here — one tap deep is reserved for the full slip. */}
      <div className="space-y-5">
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

      {sheet !== "none" && <SheetPanel kind={sheet} onClose={() => setSheet("none")} />}
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
    <Link to="/battles/$id" params={{ id }} className="block transition active:scale-[0.99]">
      <Tape className="pt-5">
        <div className="text-center font-mono">
          <p className="text-sm font-bold uppercase tracking-[0.16em]">{name}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
            {standings.data ? formatMonth(standings.data.year_month) : "—"} · {memberCount}{" "}
            {memberCount === 1 ? "player" : "players"} · {currency}
          </p>
        </div>
        <RuleLine />
        {standings.isLoading ? (
          <div className="h-20 animate-pulse rounded-lg bg-paper-2" />
        ) : standings.data ? (
          <StandingsRows snapshot={standings.data.result} meId={meId} currency={currency} />
        ) : (
          <p className="text-sm text-faint">Couldn't load standings.</p>
        )}
        <p className="mt-3 text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
          Open slip →
        </p>
      </Tape>
    </Link>
  );
}

function SheetPanel({ kind, onClose }: { kind: "create" | "join"; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const currencies = useCurrencies();
  const baseCurrency = resolveCurrency(useBaseCurrency());
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Derived, not seeded: the base currency is undefined until `useMe` resolves, so an initial value
  // would pin the field to USD even after the account's own arrives.
  const [currencyEdit, setCurrencyEdit] = useState<string | null>(null);
  const currency = currencyEdit ?? baseCurrency;

  const create = useMutation({
    mutationFn: () => api.createBattle({ name: name.trim(), currency }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["battles"] });
      navigate({ to: "/battles/$id", params: { id: res.battle.id } });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't create battle."),
  });

  const join = useMutation({
    mutationFn: () => api.joinBattle({ invite_code: code.trim().toUpperCase() }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["battles"] });
      navigate({ to: "/battles/$id", params: { id: res.battle.id } });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't join."),
  });

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl border-t border-line bg-paper p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-4 text-lg font-bold">{kind === "create" ? "Create a battle" : "Join a battle"}</h2>
        {kind === "create" ? (
          <>
            <Field label="Battle name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sibling Showdown" />
            </Field>

            <Field label="Currency" className="mt-4">
              <select
                value={currency}
                onChange={(e) => setCurrencyEdit(e.target.value)}
                className="w-full rounded-lg border border-rule bg-paper px-3 py-2.5 font-mono text-sm font-medium text-ink outline-none focus:border-accent"
              >
                {/* Until the catalogue loads, the only option is the one already selected — so the
                    control can't briefly offer a list that excludes the user's own currency. */}
                {(currencies.data ?? [{ code: currency, label: currency }]).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <p className="mt-1.5 text-xs text-faint">
              Everyone is scored in this, whatever they each spend in. It can't be changed later — past months are
              already settled in it.
            </p>
          </>
        ) : (
          <Field label="Invite code">
            <Input
              className="font-mono uppercase tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC1234"
            />
          </Field>
        )}
        {error && <p className="mt-2 text-sm text-stamp">{error}</p>}
        <Button
          full
          size="lg"
          className="mt-4"
          onClick={() => (kind === "create" ? create.mutate() : join.mutate())}
          disabled={kind === "create" ? !name.trim() || create.isPending : !code.trim() || join.isPending}
        >
          {kind === "create"
            ? create.isPending
              ? "Creating…"
              : "Create battle"
            : join.isPending
              ? "Joining…"
              : "Join battle"}
        </Button>
      </div>
    </div>
  );
}
