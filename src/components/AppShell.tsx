import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useMe } from "../lib/queries";
import { cn } from "../lib/utils";
import { Home, Plus, Settings, Swords } from "./icons";

const TABS = [
  { to: "/", label: "Home", icon: Home, exact: true, accent: false },
  { to: "/battles", label: "Battles", icon: Swords, exact: false, accent: false },
  { to: "/log", label: "Log", icon: Plus, exact: false, accent: true },
  { to: "/settings", label: "Settings", icon: Settings, exact: false, accent: false },
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
      navigate({ to: "/onboard", search: { redirect: location.pathname } });
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
        <div className="flex items-center justify-around rounded-2xl border border-line bg-surface/95 px-2 py-2 backdrop-blur">
          {TABS.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            const Icon = item.icon;
            if (item.accent) {
              return (
                <Link key={item.to} to={item.to} className="flex flex-col items-center gap-1" aria-label="Log a spend">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-accent/20 transition active:scale-95">
                    <Icon className="size-6" strokeWidth={2.8} />
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex w-16 flex-col items-center gap-1 py-1 text-[10px] font-semibold transition",
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
