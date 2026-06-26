import { Crown } from "lucide-react";
import { money } from "../lib/format";
import type { MonthlyResultSnapshot, Standing } from "../lib/types";
import { cn } from "../lib/utils";

export function StandingsRows({
  snapshot,
  meId,
  currency,
}: {
  snapshot: MonthlyResultSnapshot;
  meId: string | null;
  currency: string;
}) {
  const { standings, winnerUserId } = snapshot;
  const showRule = snapshot.winRule === "most_under_budget";
  return (
    <div className="space-y-2">
      {standings.map((s) => (
        <Row
          key={s.userId}
          s={s}
          isMe={s.userId === meId}
          isWinner={s.userId === winnerUserId}
          currency={currency}
          showUnder={showRule}
        />
      ))}
    </div>
  );
}

function Row({
  s,
  isMe,
  isWinner,
  currency,
  showUnder,
}: {
  s: Standing;
  isMe: boolean;
  isWinner: boolean;
  currency: string;
  showUnder: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3.5 py-3",
        isWinner ? "border-accent/50 bg-accent/5" : "border-line bg-surface-2",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
          isWinner ? "bg-accent text-accent-fg" : "bg-surface text-faint",
        )}
      >
        {s.rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-fg">{s.displayName}</span>
          {isMe && <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold text-muted">YOU</span>}
          {isWinner && <Crown className="size-4 text-gold" />}
        </div>
        {s.loggedCount === 0 ? (
          <span className="text-xs text-faint">no spend logged 👻</span>
        ) : (
          <span className="text-xs text-faint">{s.loggedCount} logged</span>
        )}
      </div>
      <div className="text-right">
        <div className={cn("font-bold tabular-nums", isWinner ? "text-accent" : "text-fg")}>
          {money(s.totalCents, currency)}
        </div>
        {showUnder && s.underBudgetCents !== null && (
          <div className="text-xs tabular-nums text-faint">
            {s.underBudgetCents >= 0
              ? `${money(s.underBudgetCents, currency)} under`
              : `${money(-s.underBudgetCents, currency)} over`}
          </div>
        )}
      </div>
    </div>
  );
}
