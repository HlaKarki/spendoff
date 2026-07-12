import { Money } from "./ui/money";
import type { MonthlyResultSnapshot, Standing } from "../lib/types";
import { cn } from "../lib/utils";

/** Standings print as register rows: position, name, what they've spent. */
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
    <div className="divide-y divide-dashed divide-rule">
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
    <div className="flex items-baseline gap-3 py-2.5">
      <span className={cn("w-6 shrink-0 font-mono text-[11px] font-semibold", isWinner ? "text-gold" : "text-faint")}>
        {isWinner ? "W" : String(s.rank).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("truncate text-sm font-semibold", isWinner ? "text-accent" : "text-ink")}>
            {s.displayName}
          </span>
          {isMe && <span className="font-mono text-[10px] uppercase text-faint">you</span>}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wide text-faint">
          {s.loggedCount === 0 ? "no spend logged 👻" : `${s.loggedCount} logged`}
        </span>
      </div>
      <div className="text-right">
        <Money
          minor={s.totalCents}
          currency={currency}
          className={cn("text-sm", isWinner ? "text-accent" : "text-ink")}
        />
        {showUnder && s.underBudgetCents !== null && (
          <div className="font-mono text-[10px] tabular-nums text-faint">
            {s.underBudgetCents >= 0 ? (
              <>
                <Money minor={s.underBudgetCents} currency={currency} className="font-mono text-[10px] font-normal" />{" "}
                under
              </>
            ) : (
              <>
                <Money minor={-s.underBudgetCents} currency={currency} className="font-mono text-[10px] font-normal" />{" "}
                over
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
