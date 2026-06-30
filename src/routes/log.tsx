import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Delete, Check, Repeat } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { CategoryIcon } from "../components/icons";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { logExpense } from "../lib/outbox";
import { useCategories } from "../lib/queries";
import { cn } from "../lib/utils";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export const Route = createFileRoute("/log")({
  component: () => (
    <ClientOnly>
      <AppShell>
        <LogScreen />
      </AppShell>
    </ClientOnly>
  ),
});

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"] as const;

function LogScreen() {
  const categories = useCategories();
  const qc = useQueryClient();
  const [cents, setCents] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; offline: boolean } | null>(null);
  const today = new Date().getDate();

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
        // Creating the rule also materializes this month's entry server-side (one entry, no dupe).
        await api.createRecurring({
          amount_cents: cents,
          category_id: categoryId,
          note: note.trim() || null,
          day_of_month: today,
        });
      } else {
        const res = await logExpense({
          client_id: crypto.randomUUID(),
          amount_cents: cents,
          category_id: categoryId,
          note: note.trim() || null,
          spent_at: new Date().toISOString(),
        });
        offline = !res.online;
      }
      await qc.invalidateQueries();
      setToast({ msg: repeat ? `Logged ${money(cents)} · repeats monthly` : `Logged ${money(cents)}`, offline });
      setCents(0);
      setNote("");
      setShowNote(false);
      setRepeat(false);
      setTimeout(() => setToast(null), 2200);
    } catch {
      setToast({ msg: "Couldn't save — try again", offline: false });
      setTimeout(() => setToast(null), 2200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <header className="pb-3 pt-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Log a spend</h1>
      </header>

      {/* Amount */}
      <div className="flex flex-1 flex-col items-center justify-center py-2">
        <div
          className={cn("font-display font-black tabular-nums transition-colors", cents > 0 ? "text-fg" : "text-faint")}
        >
          <span className="text-6xl">{money(cents)}</span>
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
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border py-2.5 transition",
                active ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-muted",
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
        <input
          autoFocus
          className="input mb-3"
          placeholder="Note (optional)"
          value={note}
          maxLength={280}
          onChange={(e) => setNote(e.target.value)}
        />
      ) : (
        <button onClick={() => setShowNote(true)} className="mb-3 self-start text-sm font-semibold text-faint">
          + Add note
        </button>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className="flex h-14 items-center justify-center rounded-xl bg-surface text-2xl font-semibold text-fg transition active:bg-surface-2"
          >
            {k === "del" ? <Delete className="size-6 text-muted" /> : k}
          </button>
        ))}
      </div>

      {/* Repeat monthly */}
      <button
        onClick={() => setRepeat((r) => !r)}
        className="mt-3 flex w-full items-center justify-between rounded-xl bg-surface px-4 py-3"
      >
        <span className="flex items-center gap-2.5">
          <Repeat className={cn("size-4", repeat ? "text-accent" : "text-faint")} />
          <span className="text-left">
            <span className={cn("block text-sm font-medium", repeat ? "text-fg" : "text-muted")}>Repeat monthly</span>
            {repeat && <span className="block text-xs text-faint">Auto-logs on the {ordinal(today)} each month</span>}
          </span>
        </span>
        <span className={cn("h-6 w-11 shrink-0 rounded-full p-0.5 transition", repeat ? "bg-accent" : "bg-surface-2")}>
          <span className={cn("block size-5 rounded-full bg-fg transition", repeat && "translate-x-5")} />
        </span>
      </button>

      <button onClick={save} disabled={!canSave} className="btn-primary mt-3 w-full py-4 text-base">
        {saving ? "Saving…" : "Save"}
      </button>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-28 z-40 mx-auto flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-fg shadow-lg"
          >
            <Check className="size-4" /> {toast.msg}
            {toast.offline && <span className="opacity-70">· queued offline</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
