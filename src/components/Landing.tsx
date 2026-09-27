import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "./ui/button";
import { RuleLine } from "./ui/rule-line";
import { Stamp } from "./ui/stamp";
import { Tape } from "./ui/tape";
import { TapeLabel } from "./ui/tape-label";
import { ApiError } from "../lib/api";
import { startGuest } from "../lib/guest";
import { cn } from "../lib/utils";

/* The logged-out marketing surface at "/" — the only screen a crawler ever sees,
 * so everything here must render complete without JS. Reveals (receipt print,
 * stamp thunk) only arm for elements that start below the fold. */

function useOnView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [armed, setArmed] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.getBoundingClientRect().top < window.innerHeight) return;
    setArmed(true);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, armed, seen };
}

const SHOTS = {
  today: {
    alt: "The Today screen: $12.50 typed on the keypad, Food selected, two live battles pinned above.",
  },
  "log-detail": {
    alt: "Close-up of logging a spend: $12.50 typed, the Food category selected.",
  },
  slip: {
    alt: "A battle slip: maya leading Alex by $117.80, with live July standings and the day-by-day tape.",
  },
  stats: {
    alt: "The Stats screen: month total, six-month trend bars, and a category breakdown.",
  },
} as const;

function Phone({ shot, eager, className }: { shot: keyof typeof SHOTS; eager?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[52px] bg-[#141310] p-3 shadow-[0_24px_60px_-16px_rgb(0_0_0/0.45)] ring-1 ring-white/10",
        className,
      )}
    >
      <picture>
        <source media="(prefers-color-scheme: dark)" srcSet={`/images/landing/${shot}-dark.webp`} />
        <img
          src={`/images/landing/${shot}-light.webp`}
          alt={SHOTS[shot].alt}
          width={780}
          height={1688}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding="async"
          className="w-full rounded-[40px]"
        />
      </picture>
    </div>
  );
}

function DetailCard({ shot, className }: { shot: keyof typeof SHOTS; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-paper shadow-paper", className)}>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcSet={`/images/landing/${shot}-dark.webp`} />
        <img
          src={`/images/landing/${shot}-light.webp`}
          alt={SHOTS[shot].alt}
          width={780}
          height={1036}
          loading="lazy"
          decoding="async"
          className="w-full"
        />
      </picture>
    </div>
  );
}

function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-mono font-bold uppercase tracking-[0.18em] text-ink", className)}>Spendoff</span>;
}

const BEATS = [
  {
    n: "01",
    label: "Log",
    shot: "log-detail",
    title: "Two taps and it's on the tape.",
    body: "Amount, category, done. Logging is the whole home screen. Offline in a checkout line? It queues on your phone and syncs itself when you're back.",
  },
  {
    n: "02",
    label: "Battle",
    shot: "slip",
    title: "Your circle, one slip.",
    body: "Create a battle and share the code. Everyone sees the standings and the gap to the leader, never each other's line items. Totals compete; notes stay yours.",
  },
  {
    n: "03",
    label: "Showdown",
    shot: "stats",
    title: "The 1st settles it.",
    body: "The month locks, the result gets stamped, and the recap hands out category winners, trends, and roast-y callouts. Then a fresh slip starts.",
  },
] as const;

const RECEIPT_ITEMS = [
  "Passkey sign-in",
  "Magic-link fallback",
  "Offline logging",
  "Live standings",
  "Month-end showdown",
  "Roast-y callouts",
  "Installs like an app",
] as const;

function FeatureReceipt() {
  const lines = useOnView<HTMLUListElement>();
  const stamp = useOnView<HTMLDivElement>();
  return (
    <Tape className="mx-auto w-full max-w-sm px-7 pb-9 pt-7 font-mono">
      <p className="text-center text-sm font-bold uppercase tracking-[0.18em]">Spendoff</p>
      <p className="mt-1 text-center text-[11px] uppercase tracking-[0.14em] text-faint">Every feature, every month</p>
      <RuleLine className="my-4" />
      <ul ref={lines.ref} className={cn(lines.armed && "land-print", lines.armed && lines.seen && "printed")}>
        {RECEIPT_ITEMS.map((item, i) => (
          <li
            key={item}
            style={{ transitionDelay: lines.armed ? `${i * 70}ms` : undefined }}
            className="flex items-baseline justify-between gap-3 py-1 text-[13px] uppercase tracking-wide text-muted"
          >
            <span>{item}</span>
            <span className="text-ink tabular-nums">0.00</span>
          </li>
        ))}
      </ul>
      <RuleLine className="my-4" />
      <div className="flex items-baseline justify-between text-sm font-bold uppercase tracking-wide">
        <span>Total</span>
        <span className="tabular-nums">$0.00</span>
      </div>
      <div ref={stamp.ref} className="mt-5 text-center">
        <Stamp thunk={stamp.seen} className="px-3 py-1 text-sm">
          Free
        </Stamp>
      </div>
      <p className="mt-5 text-center text-[10px] uppercase tracking-[0.14em] text-faint">
        No card. No catch. Just bragging rights.
      </p>
    </Tape>
  );
}

/** Starts a guest account so a visitor can log a spend before deciding to sign up. */
function StartFree({ className }: { className?: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await startGuest(qc);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError("Too many new guests from here. Try again in a minute.");
        setBusy(false);
        return;
      }
      // A broken guest path must never block sign-up, so fall back to the account form.
      navigate({ to: "/onboard", search: { redirect: "/" } });
    }
  }

  return (
    <span className="inline-flex flex-col items-center gap-2">
      <Button size="lg" className={className} onClick={start} disabled={busy}>
        {busy ? "Starting…" : "Start free"}
      </Button>
      {error && <span className="text-sm text-stamp">{error}</span>}
    </span>
  );
}

export function Landing() {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-6">
        <Wordmark className="text-base" />
        <Link
          to="/onboard"
          search={{ redirect: "/" }}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "font-mono uppercase tracking-wide" })}
        >
          Sign in
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-14 px-6 pb-24 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Spend less.
              <br />
              Win the month.
            </h1>
            <p className="mt-6 max-w-[46ch] text-pretty text-lg leading-relaxed text-muted">
              The monthly spending duel for you and your people. Everyone logs their own spends in two taps, and on the
              1st the lowest total takes it.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <StartFree className="px-7" />
              <a href="#how" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                See how it works
              </a>
            </div>
            <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
              No ads. No bank linking. Notes stay private.
            </p>
          </div>
          <Phone shot="today" eager className="mx-auto w-full max-w-[340px] -rotate-1 lg:mx-0 lg:justify-self-end" />
        </section>

        <section id="how" className="mx-auto max-w-5xl scroll-mt-10 px-6 pb-8">
          <TapeLabel className="text-xs">How it works</TapeLabel>
          <div className="mt-12 space-y-24">
            {BEATS.map((beat, i) => (
              <div key={beat.n} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
                {beat.shot === "log-detail" ? (
                  <DetailCard
                    shot={beat.shot}
                    className={cn("mx-auto w-full max-w-[300px]", i % 2 === 1 && "lg:order-last")}
                  />
                ) : (
                  <Phone
                    shot={beat.shot}
                    className={cn("mx-auto w-full max-w-[300px]", i % 2 === 1 && "lg:order-last")}
                  />
                )}
                <div className={cn("mx-auto max-w-md lg:mx-0", i % 2 === 1 && "lg:justify-self-end")}>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                    {beat.n} {beat.label}
                  </p>
                  <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight">{beat.title}</h2>
                  <p className="mt-4 text-pretty leading-relaxed text-muted">{beat.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-24">
          <FeatureReceipt />
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-28 text-center">
          <h2 className="text-balance text-4xl font-bold tracking-tight">This month is already running.</h2>
          <p className="mx-auto mt-4 max-w-[42ch] text-pretty leading-relaxed text-muted">
            Every unlogged day is a point for the other side. Start the duel. Your rival could use the head start.
          </p>
          <StartFree className="mt-9 px-8" />
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-6 pb-12">
        <RuleLine className="mb-6" />
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          <Wordmark className="text-[11px] text-faint" />
          <nav className="flex gap-6">
            <a
              href="https://apps.apple.com/us/app/spendoff/id6794655495"
              target="_blank"
              rel="noreferrer"
              className="hover:text-muted"
            >
              iPhone app
            </a>
            <Link to="/privacy" className="hover:text-muted">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-muted">
              Terms
            </Link>
            <Link to="/onboard" search={{ redirect: "/" }} className="hover:text-muted">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
