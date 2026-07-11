import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { CategoryIcon } from "../components/icons";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { useCategories, useRecurring } from "../lib/queries";
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
      <header className="flex items-center gap-3 pt-2">
        <Link to="/settings" className="text-faint">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">Recurring</h1>
      </header>

      <p className="text-sm text-muted">
        Fixed monthly costs — rent, subscriptions — auto-log on the day you pick, in every battle you're in that month.
      </p>

      <AddRecurring />

      <section className="space-y-2">
        <h2 className="label">Your recurring</h2>
        {rules.isLoading ? (
          <div className="h-20 animate-pulse rounded-xl bg-surface" />
        ) : !rules.data || rules.data.length === 0 ? (
          <p className="card px-4 py-3 text-sm text-muted">Nothing recurring yet.</p>
        ) : (
          <div className="card divide-y divide-line">
            {rules.data.map((r) => (
              <RecurringRow key={r.id} rule={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AddRecurring() {
  const qc = useQueryClient();
  const categories = useCategories();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [day, setDay] = useState("1");
  const [note, setNote] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.createRecurring({
        amount_cents: Math.round(Number(amount || 0) * 100),
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
    },
  });

  const canAdd = Number(amount) > 0 && !!categoryId && Number(day) >= 1 && !create.isPending;

  return (
    <section className="card space-y-3 px-4 py-4">
      <h2 className="label">Add a recurring expense</h2>
      <input
        className="input py-2"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="Amount (e.g. 1500)"
      />
      <div className="grid grid-cols-5 gap-2">
        {categories.data?.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border py-2 transition",
              categoryId === c.id ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-muted",
            )}
          >
            <CategoryIcon name={c.icon} className="size-4" />
            <span className="text-[9px] font-semibold leading-none">{c.label}</span>
          </button>
        ))}
      </div>
      <label className="flex items-center justify-between gap-2 text-sm text-faint">
        Day of month
        <input
          className="input w-20 py-2 text-center"
          inputMode="numeric"
          value={day}
          onChange={(e) => setDay(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
          placeholder="1"
        />
      </label>
      <input
        className="input py-2"
        value={note}
        maxLength={280}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
      />
      <button onClick={() => create.mutate()} disabled={!canAdd} className="btn-primary w-full py-3">
        {create.isPending ? "Adding…" : "Add recurring"}
      </button>
    </section>
  );
}

function RecurringRow({ rule }: { rule: RecurringExpense }) {
  const qc = useQueryClient();
  const categories = useCategories();
  const category: Category | null = categories.data?.find((c) => c.id === rule.category_id) ?? null;
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(rule.amount_cents / 100));
  const [categoryId, setCategoryId] = useState(rule.category_id);
  const [day, setDay] = useState(String(rule.day_of_month));
  const [note, setNote] = useState(rule.note ?? "");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["recurring"] });

  const save = useMutation({
    mutationFn: () =>
      api.updateRecurring(rule.id, {
        amount_cents: Math.round(Number(amount || 0) * 100),
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
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setEditing(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <CategoryIcon
            name={category?.icon ?? "ellipsis"}
            className={cn("size-5 shrink-0", rule.active ? "text-faint" : "text-faint/40")}
          />
          <div className="min-w-0 flex-1">
            <div className={cn("truncate font-medium", !rule.active && "text-faint line-through")}>
              {category?.label ?? "Other"}
            </div>
            <div className="truncate text-xs text-faint">
              {ordinal(rule.day_of_month)} of the month{rule.note ? ` · ${rule.note}` : ""}
            </div>
          </div>
          <div className={cn("shrink-0 font-semibold tabular-nums", !rule.active && "text-faint")}>
            {money(rule.amount_cents, rule.currency)}
          </div>
        </button>
        <button
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          aria-label={rule.active ? "Pause" : "Resume"}
          className={cn("h-6 w-11 shrink-0 rounded-full p-0.5 transition", rule.active ? "bg-accent" : "bg-surface-2")}
        >
          <span className={cn("block size-5 rounded-full bg-fg transition", rule.active && "translate-x-5")} />
        </button>
      </div>
    );
  }

  const canSave = Number(amount) > 0 && !!categoryId && Number(day) >= 1 && !save.isPending;

  return (
    <div className="space-y-3 px-4 py-3">
      <input
        className="input py-2"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="0.00"
      />
      <div className="grid grid-cols-5 gap-2">
        {categories.data?.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border py-2 transition",
              categoryId === c.id ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-muted",
            )}
          >
            <CategoryIcon name={c.icon} className="size-4" />
            <span className="text-[9px] font-semibold leading-none">{c.label}</span>
          </button>
        ))}
      </div>
      <label className="flex items-center justify-between gap-2 text-sm text-faint">
        Day of month
        <input
          className="input w-20 py-2 text-center"
          inputMode="numeric"
          value={day}
          onChange={(e) => setDay(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
          placeholder="1"
        />
      </label>
      <input
        className="input py-2"
        value={note}
        maxLength={280}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => del.mutate()}
          disabled={del.isPending}
          className="btn-ghost px-3 py-2 text-sm text-danger"
        >
          <Trash2 className="size-4" /> Delete
        </button>
        <div className="flex-1" />
        <button onClick={() => setEditing(false)} className="btn-ghost px-3 py-2 text-sm">
          Cancel
        </button>
        <button onClick={() => save.mutate()} disabled={!canSave} className="btn-primary px-4 py-2 text-sm">
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function clampDay(v: string): number {
  return Math.min(31, Math.max(1, Number(v || 1)));
}
