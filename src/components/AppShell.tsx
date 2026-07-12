import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useMe } from "../lib/queries";
import { cn } from "../lib/utils";
import { BarChart3, Plus, Settings, Swords } from "./icons";

/* Counter IA (HLA-147): four tabs, no center accent button — logging IS home,
 * so the register needs no shortcut. */
const TABS = [
  { to: "/", label: "Today", icon: Plus, exact: true },
  { to: "/battles", label: "Battles", icon: Swords, exact: false },
  { to: "/analytics", label: "Stats", icon: BarChart3, exact: false },
  { to: "/settings", label: "Settings", icon: Settings, exact: false },
] as const;

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <div className="animate-pulse font-display text-2xl font-bold tracking-tight text-accent">Spendoff</div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (me.data === null) {
      // Never bounce the user back into an auth route (would loop after sign-in).
      const from =
        location.pathname.startsWith("/onboard") || location.pathname.startsWith("/auth") ? "/" : location.pathname;
      navigate({ to: "/onboard", search: { redirect: from } });
    }
  }, [me.data, navigate, location.pathname]);

  if (me.isLoading || me.data === undefined) return <Splash />;
  if (me.data === null) return <Splash />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-bg">
      <main className="flex-1 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">{children}</main>
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const location = useLocation();
  const path = location.pathname;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30">
      <div className="mx-auto max-w-lg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around rounded-2xl border border-line bg-paper/95 px-2 py-2 backdrop-blur">
          {TABS.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex w-16 flex-col items-center gap-1 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide transition",
                  active ? "text-accent" : "text-faint hover:text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={2.2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
