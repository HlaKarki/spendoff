import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, BellOff, ChevronRight, LogOut, Repeat } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { api, ApiError } from "../lib/api";
import { browserTimezone } from "../lib/format";
import { useMe } from "../lib/queries";
import { currentPushSubscription, disablePush, enablePush, isPushSupported } from "../lib/push";

export const Route = createFileRoute("/settings")({
  component: () => (
    <ClientOnly>
      <AppShell>
        <Settings />
      </AppShell>
    </ClientOnly>
  ),
});

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
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
      </header>

      <section className="card divide-y divide-line">
        <Row label="Name" value={me.data?.display_name ?? "—"} />
        <Row label="Email" value={me.data?.email ?? "—"} />
      </section>

      <TimezoneSection />

      <Link to="/recurring" className="card flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <Repeat className="size-5 text-faint" />
          <div className="text-left">
            <div className="font-medium">Recurring expenses</div>
            <div className="text-xs text-faint">Auto-log fixed monthly costs</div>
          </div>
        </div>
        <ChevronRight className="size-5 text-faint" />
      </Link>

      <section className="space-y-2">
        <h2 className="label">Notifications</h2>
        <button
          onClick={togglePush}
          disabled={pushBusy}
          className="card flex w-full items-center justify-between px-4 py-4"
        >
          <div className="flex items-center gap-3">
            {pushOn ? <Bell className="size-5 text-accent" /> : <BellOff className="size-5 text-faint" />}
            <div className="text-left">
              <div className="font-medium">Daily reminders & results</div>
              <div className="text-xs text-faint">{pushOn ? "On" : "Off"}</div>
            </div>
          </div>
          <span className={`h-6 w-11 rounded-full p-0.5 transition ${pushOn ? "bg-accent" : "bg-surface-2"}`}>
            <span className={`block size-5 rounded-full bg-fg transition ${pushOn ? "translate-x-5" : ""}`} />
          </span>
        </button>
        {pushMsg && <p className="text-sm text-danger">{pushMsg}</p>}
        <button onClick={sendTest} disabled={testBusy} className="btn-outline w-full py-3 text-sm">
          {testBusy ? "Sending…" : "Send a test notification"}
        </button>
        {testMsg && <p className="text-sm text-muted">{testMsg}</p>}
        <p className="text-xs text-faint">
          On iPhone, add Spendoff to your Home Screen first to receive push. Otherwise notifications arrive by email.
        </p>
      </section>

      <button onClick={signOut} className="btn-ghost w-full py-3 text-danger">
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-faint">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
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
    <section className="space-y-2">
      <h2 className="label">Timezone</h2>
      <div className="card space-y-3 px-4 py-4">
        <select
          value={current ?? ""}
          disabled={!current || save.isPending}
          onChange={(e) => {
            setMsg(null);
            save.mutate(e.target.value);
          }}
          className="w-full rounded-lg bg-surface-2 px-3 py-2.5 font-medium disabled:opacity-60"
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
          <button
            onClick={() => {
              setMsg(null);
              save.mutate(device);
            }}
            disabled={save.isPending}
            className="btn-outline w-full py-2.5 text-sm"
          >
            Use this device's timezone ({device.replace(/_/g, " ")})
          </button>
        )}

        <p className="text-xs text-faint">
          Sets when your day starts and ends. Changing it re-files past expenses into the months they fall in here.
          Settled battle results don't change.
        </p>
        {save.isPending && <p className="text-sm text-muted">Saving…</p>}
        {msg && !save.isPending && <p className="text-sm text-muted">{msg}</p>}
      </div>
    </section>
  );
}
