import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Plus, Swords, UserPlus } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { api, ApiError } from "../lib/api";
import { useBattles } from "../lib/queries";

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
  const [sheet, setSheet] = useState<Sheet>("none");

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between pt-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Battles</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setSheet("create")} className="btn-primary py-3">
          <Plus className="size-4" /> Create
        </button>
        <button onClick={() => setSheet("join")} className="btn-outline py-3">
          <UserPlus className="size-4" /> Join
        </button>
      </div>

      {battles.data?.length === 0 && (
        <div className="card flex flex-col items-center px-6 py-12 text-center">
          <Swords className="size-10 text-accent" />
          <p className="mt-4 text-lg font-semibold">Start your first battle</p>
          <p className="mt-1 text-sm text-muted">Create one and share the invite code.</p>
        </div>
      )}

      <div className="space-y-3">
        {battles.data?.map((b) => (
          <Link key={b.id} to="/battles/$id" params={{ id: b.id }}>
            <div className="card flex items-center justify-between px-4 py-4 transition active:scale-[0.99]">
              <div>
                <div className="font-semibold">{b.name}</div>
                <div className="text-xs text-faint">
                  {b.member_count} {b.member_count === 1 ? "player" : "players"} · {b.role}
                </div>
              </div>
              <ChevronRight className="size-5 text-faint" />
            </div>
          </Link>
        ))}
      </div>

      {sheet !== "none" && <Sheet kind={sheet} onClose={() => setSheet("none")} />}
    </div>
  );
}

function Sheet({ kind, onClose }: { kind: "create" | "join"; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createBattle({ name: name.trim() }),
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
        className="w-full max-w-lg rounded-t-3xl border-t border-line bg-surface p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-4 text-lg font-bold">{kind === "create" ? "Create a battle" : "Join a battle"}</h2>
        {kind === "create" ? (
          <>
            <label className="label mb-1.5 block">Battle name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sibling Showdown" />
          </>
        ) : (
          <>
            <label className="label mb-1.5 block">Invite code</label>
            <input
              className="input uppercase tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC1234"
            />
          </>
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <button
          onClick={() => (kind === "create" ? create.mutate() : join.mutate())}
          disabled={kind === "create" ? !name.trim() || create.isPending : !code.trim() || join.isPending}
          className="btn-primary mt-4 w-full py-3.5"
        >
          {kind === "create"
            ? create.isPending
              ? "Creating…"
              : "Create battle"
            : join.isPending
              ? "Joining…"
              : "Join battle"}
        </button>
      </div>
    </div>
  );
}
