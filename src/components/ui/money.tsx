import { money, resolveCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";

/**
 * The only sanctioned way to render an amount. Minor units in, register type
 * out — mono, tabular, formatted through Intl via format.ts, so a hard-coded
 * "/100" can never reappear in a component. Pass the battle's currency for
 * anything battle-scoped; the user's base currency otherwise.
 */
export function Money({ minor, currency, className }: { minor: number; currency?: string; className?: string }) {
  return (
    <span className={cn("font-mono font-semibold tabular-nums", className)}>
      {money(minor, resolveCurrency(currency))}
    </span>
  );
}
