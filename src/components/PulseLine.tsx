import { Link } from "@tanstack/react-router";
import { money } from "../lib/format";
import { useBattles, useMe, useStandings } from "../lib/queries";
import type { Battle } from "../lib/types";

/**
 * The battle pulse above the register: one line per battle answering "am I
 * winning?" with the gap to whoever the answer depends on. Shows at most two;
 * the Battles tab is the full digest.
 */
export function PulseLine() {
  const me = useMe();
  const battles = useBattles();
  const list = battles.data ?? [];
  if (list.length === 0) return null;

  const extra = list.length - 2;
  return (
    <div className="space-y-1.5">
      {list.slice(0, 2).map((b) => (
        <BattlePulse key={b.id} battle={b} meId={me.data?.id ?? null} />
      ))}
      {extra > 0 && (
        <Link to="/battles" className="block px-1 text-xs font-semibold text-faint">
          +{extra} more {extra === 1 ? "battle" : "battles"}
        </Link>
      )}
    </div>
  );
}

function BattlePulse({ battle, meId }: { battle: Battle; meId: string | null }) {
  const standings = useStandings(battle.id);
  const snapshot = standings.data?.result;
  if (!snapshot || snapshot.standings.length < 2) return null;

  const mine = snapshot.standings.find((s) => s.userId === meId);
  if (!mine) return null;
  const leader = snapshot.standings[0];
  const status =
    mine.rank === 1
      ? `leading by ${money(snapshot.standings[1].totalCents - mine.totalCents, battle.currency)}`
      : `trailing ${leader.displayName} by ${money(mine.totalCents - leader.totalCents, battle.currency)}`;

  return (
    <Link
      to="/battles/$id"
      params={{ id: battle.id }}
      className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-line bg-surface px-3.5 py-2 text-xs"
    >
      <span className="min-w-0 truncate text-muted">
        <span className="font-mono font-bold uppercase text-fg">{battle.name}</span> · {status}
      </span>
      <span className="shrink-0 font-mono font-bold text-accent">VIEW →</span>
    </Link>
  );
}
