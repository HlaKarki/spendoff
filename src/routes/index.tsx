import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Delete, Check, Coins, Repeat, CalendarDays } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { CategoryIcon } from "../components/icons";
import { PulseLine } from "../components/PulseLine";
import { Button } from "../components/ui/button";
import { ErrorNote } from "../components/ui/error-note";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { LineItem } from "../components/ui/line-item";
import { Money } from "../components/ui/money";
import { RuleLine } from "../components/ui/rule-line";
import { Switch } from "../components/ui/switch";
import { Tape } from "../components/ui/tape";
import { TapeLabel } from "../components/ui/tape-label";
import { api } from "../lib/api";
import {
  formatTime,
  loggableDayRange,
  money,
  relativeDayKey,
  resolveCurrency,
  resolveTimezone,
  shiftDay,
  spentAtForDay,
  todayInTz,
} from "../lib/format";
import { flushOutbox, logExpense, pending } from "../lib/outbox";
import { useCategories, useCurrencies, useDayExpenses, useMe } from "../lib/queries";
import { cn } from "../lib/utils";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/* Counter IA (HLA-147): the register IS the home screen. You open the app,
 * you're logging — the pulse line above answers "am I winning?" in one glance. */
export const Route = createFileRoute("/")({
  component: () => (
    <ClientOnly>
      <AppShell>
        <TodayScreen />
      </AppShell>
    </ClientOnly>
  ),
});

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"] as const;

/* The print moment (HLA-92 motion budget): a freshly logged line feeds onto the
 * tape once, ~260ms. Everything already on the tape renders still. */
function PrintIn({ animate, children }: { animate: boolean; children: ReactNode }) {
  const [printing, setPrinting] = useState(animate);
  useEffect(() => {
    if (!printing) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setPrinting(false)));
    return () => cancelAnimationFrame(raf);
  }, [printing]);
  return (
    <div className={cn("print-wrap", printing && "printing")}>
      <div>{children}</div>
    </div>
  );
}

function TodayScreen() {
  const categories = useCategories();
  const currencies = useCurrencies();
  const me = useMe();
  const qc = useQueryClient();
  const tz = me.data?.timezone;
  const [cents, setCents] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; offline: boolean } | null>(null);
  const [justPrinted, setJustPrinted] = useState<string | null>(null);
  const [queued, setQueued] = useState(0);

  // Same reasoning as `dayEdit` below: the base currency is undefined until `useMe` resolves, so
  // seeding state with it would pin the keypad to USD even after the account's own arrives.
  const [currencyEdit, setCurrencyEdit] = useState<string | null>(null);
  const baseCurrency = resolveCurrency(me.data?.base_currency);
  const currency = currencyEdit ?? baseCurrency;
  const isForeign = currency !== baseCurrency;

  // Derived, not seeded into state: `tz` is undefined until `useMe` resolves, so an initial value
  // would pin the default day to the device's zone even after the account's arrives.
  const [dayEdit, setDayEdit] = useState<string | null>(null);
  const today = todayInTz(tz);
  const day = dayEdit ?? today;
  const range = loggableDayRange(tz);
  const dom = Number(day.slice(8, 10));
  const todayDom = Number(today.slice(8, 10));

  const dayExpenses = useDayExpenses(day);

  // Anything still sitting in the outbox is invisible to the server list; surface it honestly.
  useEffect(() => {
    pending().then((p) => setQueued(p.length));
  }, [toast]);

  // One tap for the two days people actually backfill. Yesterday drops off on the 1st, when it
  // belongs to a month that's already locked.
  const yesterday = shiftDay(today, -1);
  const quickDays = yesterday >= range.min ? [today, yesterday] : [today];
  const isCustomDay = !quickDays.includes(day);

  const dayInput = useRef<HTMLInputElement>(null);

  function openDayPicker() {
    const el = dayInput.current;
    if (!el) return;
    // showPicker() is the only way in: a date field opens its calendar from the indicator icon, which
    // the chip covers. Older browsers without it fall back to focusing the field, where the arrow
    // keys still change the date.
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  }

  function press(k: (typeof KEYS)[number]) {
    if (k === "del") return setCents((c) => Math.floor(c / 10));
    if (k === "00") return setCents((c) => Math.min(c * 100, 99_999_999));
    setCents((c) => Math.min(c * 10 + Number(k), 99_999_999));
  }

  const canSave = cents > 0 && !!categoryId && !saving;

  async function save() {
    if (!canSave || !categoryId) return;
    setSaving(true);
    try {
      let offline = false;
      if (repeat) {
        // Creating the rule also materializes this month's entry server-side (one entry, no dupe) —
        // but only once the chosen day has arrived. Pick a day still ahead and the rule simply waits.
        await api.createRecurring({
          amount_cents: cents,
          currency,
          category_id: categoryId,
          note: note.trim() || null,
          day_of_month: dom,
        });
      } else {
        const clientId = crypto.randomUUID();
        const res = await logExpense({
          client_id: clientId,
          amount_cents: cents,
          currency,
          category_id: categoryId,
          note: note.trim() || null,
          // Not `now` — the entry belongs to the day the user picked, read in their zone.
          spent_at: spentAtForDay(day, tz),
        });
        offline = !res.online;
        setJustPrinted(clientId);
      }
      await qc.invalidateQueries();
      setToast({ msg: savedMessage(), offline });
      setCents(0);
      setNote("");
      setShowNote(false);
      setRepeat(false);
      setDayEdit(null);
      // The currency is deliberately NOT reset: someone logging in euros is on a trip, and is about
      // to log another one. It falls back to base on the next visit, not the next entry.
      setTimeout(() => setToast(null), 2200);
    } catch {
      setToast({ msg: "Couldn't save — try again", offline: false });
      setTimeout(() => setToast(null), 2200);
    } finally {
      setSaving(false);
    }
  }

  function savedMessage(): string {
    const amount = money(cents, currency);
    if (repeat) {
      // Nothing is logged yet when the day is still ahead — say so rather than claim a spend landed.
      return dom > todayDom ? `Repeats monthly · starts the ${ordinal(dom)}` : `Logged ${amount} · repeats monthly`;
    }
    return day === today ? `Logged ${amount}` : `Logged ${amount} · ${relativeDayKey(day, tz)}`;
  }

  async function retrySync() {
    const { remaining } = await flushOutbox();
    setQueued(remaining);
    await qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  const zone = resolveTimezone(tz);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: zone,
  }).format(new Date());
  const [ty, tm] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(ty, tm, 0)).getUTCDate();

  const catLabel = (id: string) => categories.data?.find((c) => c.id === id)?.label ?? "";
  const dayItems = dayExpenses.data ?? [];
  const dayTotal = dayItems.reduce((sum, e) => sum + e.base_amount_cents, 0);

  return (
    <div className="flex flex-col">
      <header className="flex items-baseline justify-between px-1 pb-3 pt-2">
        <h1 className="font-mono text-base font-bold uppercase tracking-wide">{dateLabel}</h1>
        <span className="font-mono text-xs text-muted">
          day {todayDom}/{daysInMonth}
        </span>
      </header>

      <div className="pb-3">
        <PulseLine />
      </div>

      <Tape className="pt-5">
        {/* Day — today unless you say otherwise */}
        <div className="flex items-center gap-1.5">
          {quickDays.map((k) => (
            <button
              key={k}
              onClick={() => setDayEdit(k)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                day === k ? "border-accent bg-accent/10 text-accent" : "border-rule bg-paper text-muted",
              )}
            >
              {relativeDayKey(k, tz)}
            </button>
          ))}
          <label
            // preventDefault stops the label from *also* activating the input: browsers that open the
            // picker on label activation would otherwise open it twice in one gesture.
            onClick={(e) => {
              e.preventDefault();
              openDayPicker();
            }}
            className={cn(
              "relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-within:ring-2 focus-within:ring-accent/40",
              isCustomDay ? "border-accent bg-accent/10 text-accent" : "border-rule bg-paper text-muted",
            )}
          >
            <CalendarDays className="size-3.5" />
            {isCustomDay ? relativeDayKey(day, tz) : "Another day"}
            {/* The native picker owns the calendar UI and the min/max clamp. It has to stay rendered
                (opacity, not `hidden`) for showPicker() to be allowed to open it, but it takes no
                clicks of its own: clicking a date field's text doesn't open anything, and the one part
                that would — the indicator icon — is invisible under the chip. The label opens it. */}
            <input
              ref={dayInput}
              type="date"
              aria-label="Day this was spent"
              value={day}
              min={range.min}
              max={range.max}
              onChange={(e) => e.target.value && setDayEdit(e.target.value)}
              className="pointer-events-none absolute inset-0 opacity-0"
            />
          </label>

          {/* Currency sits with the day, not under the amount: both say how this entry was logged,
              and this row already exists — a row of its own would push Save under the nav bar. */}
          <label
            className={cn(
              "relative ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs font-semibold transition focus-within:ring-2 focus-within:ring-accent/40",
              isForeign ? "border-accent bg-accent/10 text-accent" : "border-rule bg-paper text-muted",
            )}
          >
            <Coins className="size-3.5" />
            {currency}
            <select
              aria-label="Currency this was spent in"
              value={currency}
              onChange={(e) => setCurrencyEdit(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {/* Until the catalogue loads, the only option is the one already selected — so the
                  control can't briefly offer a list that excludes the user's own currency. */}
              {(currencies.data ?? [{ code: currency, label: currency }]).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-1.5 min-h-4 text-xs text-faint">
          {isForeign
            ? // Not "today's rate": the ECB doesn't publish on weekends, so a Sunday spend honestly
              // prices at Friday's. The exact rate and its date land on the expense once it's saved.
              `Converted to ${baseCurrency} at the rate for the day you spent it`
            : day > today
              ? "Counts toward this month's total right away"
              : isCustomDay
                ? "Backdated — this month only, once a month closes it's locked"
                : ""}
        </p>

        {/* Amount — register output, always mono */}
        <div className="flex flex-col items-center py-5">
          <TapeLabel>Amount</TapeLabel>
          <div
            className={cn(
              "mt-1 font-mono text-5xl font-bold tabular-nums transition-colors",
              cents > 0 ? "text-ink" : "text-faint",
            )}
          >
            {money(cents, currency)}
          </div>
        </div>

        {/* Categories */}
        <div className="mb-3 grid grid-cols-5 gap-2">
          {categories.data?.map((c) => {
            const active = categoryId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border py-2.5 transition",
                  active ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-muted hover:bg-paper-2",
                )}
              >
                <CategoryIcon name={c.icon} className="size-5" />
                <span className="text-[9px] font-semibold leading-none">{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Note */}
        {showNote ? (
          <Input
            autoFocus
            className="mb-3"
            placeholder="What was it? (optional)"
            value={note}
            maxLength={280}
            onChange={(e) => setNote(e.target.value)}
          />
        ) : (
          <button onClick={() => setShowNote(true)} className="mb-3 self-start text-sm font-semibold text-faint">
            + Add note
          </button>
        )}

        {/* Keypad — register keys print register digits */}
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              className="flex h-13 items-center justify-center rounded-lg border border-line bg-paper-2 font-mono text-xl font-semibold text-ink transition active:bg-line"
            >
              {k === "del" ? <Delete className="size-6 text-muted" /> : k}
            </button>
          ))}
        </div>

        {/* Repeat monthly */}
        <div className="mt-3 flex w-full items-center justify-between rounded-lg border border-rule px-4 py-3">
          <span className="flex items-center gap-2.5">
            <Repeat className={cn("size-4", repeat ? "text-accent" : "text-faint")} />
            <span className="text-left">
              <span className={cn("block text-sm font-medium", repeat ? "text-ink" : "text-muted")}>
                Repeat monthly
              </span>
              {repeat && <span className="block text-xs text-faint">Auto-logs on the {ordinal(dom)} each month</span>}
            </span>
          </span>
          <Switch checked={repeat} onChange={(e) => setRepeat(e.target.checked)} aria-label="Repeat monthly" />
        </div>

        <Button size="lg" full className="mt-4" onClick={save} disabled={!canSave}>
          {saving ? "Saving…" : "Log expense"}
        </Button>
      </Tape>

      {/* The day's tape so far */}
      <Tape className="mt-5 pt-5">
        <TapeLabel>{relativeDayKey(day, tz)} so far</TapeLabel>
        {queued > 0 && (
          <ErrorNote
            className="mt-3"
            title={`Couldn't sync ${queued} ${queued === 1 ? "expense" : "expenses"}.`}
            onRetry={retrySync}
          >
            {queued === 1 ? "It's" : "They're"} safe on this device.
          </ErrorNote>
        )}
        {dayItems.length === 0 && !dayExpenses.isLoading ? (
          <EmptyState title="Nothing logged yet.">
            {day === today ? "A no-spend day counts as a win — or log the first expense." : "Nothing on this day."}
          </EmptyState>
        ) : (
          <div className="mt-2">
            {dayItems.map((e) => (
              <PrintIn key={e.client_id} animate={e.client_id === justPrinted}>
                <LineItem
                  what={e.note?.trim() || catLabel(e.category_id)}
                  meta={`${formatTime(e.spent_at, tz)} · ${catLabel(e.category_id)}`}
                  amount={<Money minor={e.amount_cents} currency={e.currency} />}
                />
              </PrintIn>
            ))}
            <RuleLine />
            <LineItem
              className="font-mono"
              what={<span className="font-mono text-sm font-bold uppercase">{relativeDayKey(day, tz)}</span>}
              amount={<Money minor={dayTotal} currency={baseCurrency} className="text-accent" />}
            />
          </div>
        )}
      </Tape>

      {toast && (
        <output className="fixed inset-x-0 bottom-24 z-40 mx-auto flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper shadow-lg">
          <Check className="size-4" /> {toast.msg}
          {toast.offline && <span className="opacity-70">· queued offline</span>}
        </output>
      )}
    </div>
  );
}
