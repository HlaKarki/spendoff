import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { CategoryPicker } from "../components/CategoryPicker";
import { ClientOnly } from "../components/ClientOnly";
import { CategoryIcon } from "../components/icons";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { SwitchIndicator } from "../components/ui/switch";
import { Tape } from "../components/ui/tape";
import { TapeLabel } from "../components/ui/tape-label";
import { api } from "../lib/api";
import { money, resolveCurrency, toMajor, toMinor } from "../lib/format";
import { useBaseCurrency, useCategories, useCurrencies, useRecurring } from "../lib/queries";
import type { Category, RecurringExpense } from "../lib/types";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/recurring")({
  component: () => (
    <ClientOnly>
      <AppShell>
        <RecurringScreen />
      </AppShell>
    </ClientOnly>
  ),
});

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function RecurringScreen() {
  const rules = useRecurring();

  return (
    <div className="space-y-5">
      <header className="flex items-baseline gap-3 px-1 pt-2">
        <Link to="/settings" className="self-center text-faint" aria-label="Back to settings">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-mono text-base font-bold uppercase tracking-wide">Recurring</h1>
      </header>

      <p className="px-1 text-sm text-muted">
        Fixed monthly costs — rent, subscriptions — auto-log on the day you pick, in every battle you're in that month.
      </p>

      <AddRecurring />

      <Tape className="pt-5">
        <TapeLabel>Your recurring</TapeLabel>
        {rules.isLoading ? (
          <div className="mt-2 h-20 animate-pulse rounded-lg bg-paper-2" />
        ) : !rules.data || rules.data.length === 0 ? (
          <EmptyState title="Nothing recurring yet.">Rent and subscriptions log themselves from here.</EmptyState>
        ) : (
          <div className="mt-1 divide-y divide-dashed divide-rule">
            {rules.data.map((r) => (
              <RecurringRow key={r.id} rule={r} />
            ))}
          </div>
        )}
      </Tape>
    </div>
  );
}

function AddRecurring() {
  const qc = useQueryClient();
  const categories = useCategories();
  const currencies = useCurrencies();
  const baseCurrency = resolveCurrency(useBaseCurrency());
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [day, setDay] = useState("1");
  const [note, setNote] = useState("");

  // Derived, not seeded: the base currency is undefined until `useMe` resolves, so an initial value
  // would pin the field to USD even after the account's own arrives.
  const [currencyEdit, setCurrencyEdit] = useState<string | null>(null);
  const currency = currencyEdit ?? baseCurrency;

  const create = useMutation({
    mutationFn: () =>
      api.createRecurring({
        // Parsed in the rule's own currency: "1000" against a ¥ rule is ¥1000, not ¥100,000.
        amount_cents: toMinor(Number(amount || 0), currency),
        currency,
        category_id: categoryId!,
        day_of_month: clampDay(day),
        note: note.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      setAmount("");
      setCategoryId(null);
      setDay("1");
      setNote("");
      setCurrencyEdit(null);
    },
  });

  const canAdd = Number(amount) > 0 && !!categoryId && Number(day) >= 1 && !create.isPending;

  return (
    <Tape className="space-y-3 pt-5">
      <TapeLabel>Add a recurring expense</TapeLabel>
      <div className="flex gap-2">
        <Input
          className="flex-1 py-2 font-mono"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="Amount (e.g. 1500)"
          aria-label={`Amount in ${currency}`}
        />
        <select
          aria-label="Currency"
          value={currency}
          onChange={(e) => setCurrencyEdit(e.target.value)}
          className="rounded-lg border border-rule bg-paper px-3 py-2 font-mono text-sm font-medium text-ink outline-none focus:border-accent"
        >
          {/* Until the catalogue loads, the only option is the one already selected — so the control
              can't briefly offer a list that excludes the user's own currency. */}
          {(currencies.data ?? [{ code: currency }]).map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
      </div>
      <CategoryPicker
        compact
        categories={categories.data}
        value={categoryId}
        onChange={setCategoryId}
        aria-label="Recurring expense category"
      />
      <label className="flex items-center justify-between gap-2 text-sm text-faint">
        Day of month
        <Input
          className="w-20 py-2 text-center font-mono"
          inputMode="numeric"
          value={day}
          onChange={(e) => setDay(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
          placeholder="1"
        />
      </label>
      <Input
        className="py-2"
        value={note}
        maxLength={280}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
      />
      <Button full onClick={() => create.mutate()} disabled={!canAdd}>
        {create.isPending ? "Adding…" : "Add recurring"}
      </Button>
    </Tape>
  );
}

function RecurringRow({ rule }: { rule: RecurringExpense }) {
  const qc = useQueryClient();
  const categories = useCategories();
  const category: Category | null = categories.data?.find((c) => c.id === rule.category_id) ?? null;
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(toMajor(rule.amount_cents, rule.currency)));
  const [categoryId, setCategoryId] = useState(rule.category_id);
  const [day, setDay] = useState(String(rule.day_of_month));
  const [note, setNote] = useState(rule.note ?? "");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["recurring"] });

  const save = useMutation({
    mutationFn: () =>
      api.updateRecurring(rule.id, {
        // A rule's currency is fixed at creation — only the amount is editable, and it's parsed in
        // that currency.
        amount_cents: toMinor(Number(amount || 0), rule.currency),
        category_id: categoryId,
        day_of_month: clampDay(day),
        note: note.trim() || null,
      }),
    onSuccess: () => {
      invalidate();
      setEditing(false);
    },
  });
  const toggle = useMutation({
    mutationFn: () => api.updateRecurring(rule.id, { active: !rule.active }),
    onSuccess: invalidate,
  });
  const del = useMutation({ mutationFn: () => api.deleteRecurring(rule.id), onSuccess: invalidate });

  if (!editing) {
    return (
      <div className="flex items-center gap-3 py-2.5">
        <button onClick={() => setEditing(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <CategoryIcon
            name={category?.icon ?? "ellipsis"}
            className={cn("size-5 shrink-0", rule.active ? "text-faint" : "text-faint/40")}
          />
          <div className="min-w-0 flex-1">
            <div className={cn("truncate text-sm font-medium", !rule.active && "text-faint line-through")}>
              {category?.label ?? "Other"}
            </div>
            <div className="truncate font-mono text-[10px] uppercase text-faint">
              {ordinal(rule.day_of_month)} of the month{rule.note ? ` · ${rule.note}` : ""}
            </div>
          </div>
          <div className={cn("shrink-0 font-mono text-sm font-semibold tabular-nums", !rule.active && "text-faint")}>
            {money(rule.amount_cents, rule.currency)}
          </div>
        </button>
        <button
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          aria-label={rule.active ? "Pause" : "Resume"}
          className="shrink-0"
        >
          <SwitchIndicator on={rule.active} />
        </button>
      </div>
    );
  }

  const canSave = Number(amount) > 0 && !!categoryId && Number(day) >= 1 && !save.isPending;

  return (
    <div className="space-y-3 py-3">
      <Input
        className="py-2 font-mono"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="0.00"
      />
      <CategoryPicker
        compact
        categories={categories.data}
        value={categoryId}
        onChange={setCategoryId}
        aria-label="Recurring expense category"
      />
      <label className="flex items-center justify-between gap-2 text-sm text-faint">
        Day of month
        <Input
          className="w-20 py-2 text-center font-mono"
          inputMode="numeric"
          value={day}
          onChange={(e) => setDay(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
          placeholder="1"
        />
      </label>
      <Input
        className="py-2"
        value={note}
        maxLength={280}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
      />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => del.mutate()} disabled={del.isPending} className="text-stamp">
          <Trash2 className="size-4" /> Delete
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={!canSave}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function clampDay(v: string): number {
  return Math.min(31, Math.max(1, Number(v || 1)));
}
