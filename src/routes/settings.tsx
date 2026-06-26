import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, BellOff, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { ClientOnly } from "../components/ClientOnly";
import { api } from "../lib/api";
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
        <Row label="Timezone" value={me.data?.timezone ?? "—"} />
      </section>

      <section className="space-y-2">
        <h2 className="label">Notifications</h2>
        <button onClick={togglePush} disabled={pushBusy} className="card flex w-full items-center justify-between px-4 py-4">
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
        <p className="text-xs text-faint">On iPhone, add Spendoff to your Home Screen first to receive notifications.</p>
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
