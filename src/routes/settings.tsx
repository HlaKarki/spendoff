import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, BellOff, ChevronRight, LogOut, Repeat } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { Button } from "../components/ui/button";
import { RuleLine } from "../components/ui/rule-line";
import { SwitchIndicator } from "../components/ui/switch";
import { Tape } from "../components/ui/tape";
import { TapeLabel } from "../components/ui/tape-label";
import { api, ApiError } from "../lib/api";
import { browserCurrency, browserTimezone } from "../lib/format";
import { useCurrencies, useMe } from "../lib/queries";
import { currentPushSubscription, disablePush, enablePush, isPushSupported } from "../lib/push";
import { getThemePref, setThemePref, type ThemePref } from "../lib/theme";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/settings")({
  component: () => (
    <ClientOnly>
      <AppShell>
        <Settings />
      </AppShell>
    </ClientOnly>
  ),
});

const SELECT_CLASSES =
  "w-full rounded-lg border border-rule bg-paper px-3 py-2.5 font-mono text-sm font-medium text-ink outline-none focus:border-accent disabled:opacity-60";

function Settings() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  useEffect(() => {
    if (isPushSupported()) currentPushSubscription().then((s) => setPushOn(!!s));
  }, []);

  async function togglePush() {
    setPushBusy(true);
    setPushMsg(null);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
      } else {
        const res = await enablePush();
        if (res.ok) setPushOn(true);
        else setPushMsg(res.reason ?? "Couldn't enable notifications.");
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function sendTest() {
    setTestBusy(true);
    setTestMsg(null);
    try {
      const res = await api.notifyTest();
      setTestMsg(
        res.channel === "push"
          ? "Sent as a push notification ✓"
          : res.channel === "email"
            ? "Sent to your email ✓ (check inbox/spam)"
            : "Couldn't send — check your setup.",
      );
    } catch {
      setTestMsg("Couldn't send right now.");
    } finally {
      setTestBusy(false);
    }
  }

  async function signOut() {
    await api.logout();
    await qc.invalidateQueries({ queryKey: ["me"] });
    navigate({ to: "/onboard", search: { redirect: "/" } });
  }

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between px-1 pt-2">
        <h1 className="font-mono text-base font-bold uppercase tracking-wide">Settings</h1>
        <span className="font-mono text-xs text-muted">you</span>
      </header>

      <Tape className="pt-5">
        <Row label="Name" value={me.data?.display_name ?? "—"} mono={false} />
        <RuleLine className="my-1" />
        <Row label="Email" value={me.data?.email ?? "—"} />
      </Tape>

      <ThemeSection />

      <BaseCurrencySection />

      <TimezoneSection />

      <Link to="/recurring" className="block">
        <Tape className="pb-5 pt-4">
          <span className="flex items-center justify-between">
            <span className="flex items-center gap-3">
              <Repeat className="size-5 text-faint" />
              <span className="text-left">
                <span className="block text-sm font-medium">Recurring expenses</span>
                <span className="block text-xs text-faint">Auto-log fixed monthly costs</span>
              </span>
            </span>
            <ChevronRight className="size-5 text-faint" />
          </span>
        </Tape>
      </Link>

      <Tape className="pt-5">
        <TapeLabel className="text-left">Notifications</TapeLabel>
        <button
          onClick={togglePush}
          disabled={pushBusy}
          className="mt-2 flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-3">
            {pushOn ? <Bell className="size-5 text-accent" /> : <BellOff className="size-5 text-faint" />}
            <span>
              <span className="block text-sm font-medium">Daily reminders & results</span>
              <span className="block text-xs text-faint">{pushOn ? "On" : "Off"}</span>
            </span>
          </span>
          <SwitchIndicator on={pushOn} />
        </button>
        {pushMsg && <p className="mt-2 text-sm text-stamp">{pushMsg}</p>}
        <RuleLine className="my-3" />
        <Button variant="outline" size="sm" full onClick={sendTest} disabled={testBusy}>
          {testBusy ? "Sending…" : "Send a test notification"}
        </Button>
        {testMsg && <p className="mt-2 text-sm text-muted">{testMsg}</p>}
        <p className="mt-2 text-xs text-faint">
          On iPhone, add Spendoff to your Home Screen first to receive push. Otherwise notifications arrive by email.
        </p>
      </Tape>

      <Button variant="ghost" full onClick={signOut} className="text-stamp">
        <LogOut className="size-4" /> Sign out
      </Button>
    </div>
  );
}

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <span className={cn("min-w-0 truncate text-sm text-muted", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

/* Theme override is per-device (HLA-92 decision): localStorage, applied before
 * first paint by the inline script in __root.tsx. "Auto" follows the device. */
function ThemeSection() {
  const [pref, setPref] = useState<ThemePref>(() => getThemePref());
  const OPTIONS: { value: ThemePref; label: string }[] = [
    { value: "auto", label: "Auto" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];
  return (
    <Tape className="pt-5">
      <TapeLabel className="text-left">Theme</TapeLabel>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            aria-pressed={pref === o.value}
            onClick={() => {
              setThemePref(o.value);
              setPref(o.value);
            }}
            className={cn(
              "rounded-lg border px-2 py-2.5 text-xs font-semibold transition",
              pref === o.value ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-muted",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-faint">Auto follows this device's appearance. The choice stays on this device.</p>
    </Tape>
  );
}

/** IANA zone ids, newest ICU list. Callers must union in the account/device zones — see below. */
function supportedZones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    return list?.length ? list : [];
  } catch {
    return [];
  }
}

function BaseCurrencySection() {
  const me = useMe();
  const currencies = useCurrencies();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const current = me.data?.base_currency;
  const device = browserCurrency();

  const save = useMutation({
    mutationFn: (base_currency: string) => api.updateMe({ base_currency }),
    onSuccess: async (res) => {
      const n = res.reconverted_expenses;
      setMsg(n > 0 ? `Saved. ${n} expense${n === 1 ? "" : "s"} re-priced in ${res.user.base_currency}.` : "Saved.");
      // Every total the app shows is denominated in this, so nothing cached survives it — not just ["me"].
      await qc.invalidateQueries();
    },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : "Couldn't save that right now."),
  });

  return (
    <Tape className="pt-5">
      <TapeLabel className="text-left">Currency</TapeLabel>
      <div className="mt-2 space-y-3">
        <select
          value={current ?? ""}
          disabled={!current || save.isPending}
          onChange={(e) => {
            setMsg(null);
            save.mutate(e.target.value);
          }}
          className={SELECT_CLASSES}
        >
          {!current && <option value="">Loading…</option>}
          {(currencies.data ?? []).map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.label}
            </option>
          ))}
        </select>

        {!!current && current !== device && (
          <Button
            variant="outline"
            size="sm"
            full
            onClick={() => {
              setMsg(null);
              save.mutate(device);
            }}
            disabled={save.isPending}
          >
            Use this device's currency ({device})
          </Button>
        )}

        <p className="text-xs text-faint">
          Your totals are shown in this. You can still log a spend in any currency — it's converted at the rate for the
          day you spent it, and the original is kept. Changing this re-prices your history from those originals, so
          nothing drifts. Battles are scored in the battle's own currency.
        </p>
        {save.isPending && <p className="text-sm text-muted">Saving…</p>}
        {msg && !save.isPending && <p className="text-sm text-muted">{msg}</p>}
      </div>
    </Tape>
  );
}

function TimezoneSection() {
  const me = useMe();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const device = browserTimezone();
  const current = me.data?.timezone;

  // Union in the account's and the device's own zones: the ICU list is build-dependent and can omit
  // ids real browsers report (some builds list Asia/Calcutta but not Asia/Kolkata). Without this the
  // select could fail to show the zone you're actually on.
  const zones = useMemo(() => {
    const set = new Set(supportedZones());
    if (device) set.add(device);
    if (current) set.add(current);
    // oxlint-disable-next-line no-array-sort -- spread creates a fresh array, safe to sort in place
    return [...set].sort();
  }, [device, current]);

  const groups = useMemo(() => {
    const byArea = new Map<string, string[]>();
    for (const z of zones) {
      const area = z.includes("/") ? z.slice(0, z.indexOf("/")) : "Other";
      const list = byArea.get(area) ?? [];
      list.push(z);
      byArea.set(area, list);
    }
    // oxlint-disable-next-line no-array-sort -- spread creates a fresh array, safe to sort in place
    return [...byArea.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [zones]);

  const save = useMutation({
    mutationFn: (timezone: string) => api.updateMe({ timezone }),
    onSuccess: async (res) => {
      const n = res.rebucketed_expenses;
      setMsg(n > 0 ? `Saved. ${n} expense${n === 1 ? "" : "s"} moved to a different month.` : "Saved.");
      // Month totals, day grouping and the daily dots are all computed server-side from this zone,
      // so everything cached is now stale — not just ["me"].
      await qc.invalidateQueries();
    },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : "Couldn't save that right now."),
  });

  const mismatched = !!current && !!device && current !== device;

  return (
    <Tape className="pt-5">
      <TapeLabel className="text-left">Timezone</TapeLabel>
      <div className="mt-2 space-y-3">
        <select
          value={current ?? ""}
          disabled={!current || save.isPending}
          onChange={(e) => {
            setMsg(null);
            save.mutate(e.target.value);
          }}
          className={SELECT_CLASSES}
        >
          {!current && <option value="">Loading…</option>}
          {groups.map(([area, list]) => (
            <optgroup key={area} label={area}>
              {list.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {mismatched && (
          <Button
            variant="outline"
            size="sm"
            full
            onClick={() => {
              setMsg(null);
              save.mutate(device);
            }}
            disabled={save.isPending}
          >
            Use this device's timezone ({device.replace(/_/g, " ")})
          </Button>
        )}

        <p className="text-xs text-faint">
          Sets when your day starts and ends. Changing it re-files past expenses into the months they fall in here.
          Settled battle results don't change.
        </p>
        {save.isPending && <p className="text-sm text-muted">Saving…</p>}
        {msg && !save.isPending && <p className="text-sm text-muted">{msg}</p>}
      </div>
    </Tape>
  );
}
