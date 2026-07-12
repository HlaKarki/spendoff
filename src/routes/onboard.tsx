import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { browserCurrency, browserTimezone } from "../lib/format";
import type { User } from "../lib/types";

export const Route = createFileRoute("/onboard")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
  }),
  component: Onboard,
});

type Mode = "signin" | "create";

function Onboard() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState<string | null>(null);

  // Seed the user into the cache synchronously (no refetch race), then go somewhere safe.
  function finishAuth(user: User) {
    qc.setQueryData(["me"], user);
    const safe = redirect && !redirect.startsWith("/onboard") && !redirect.startsWith("/auth") ? redirect : "/";
    navigate({ to: safe });
  }

  async function createAccount() {
    setError(null);
    if (!email.trim() || !name.trim()) return setError("Enter your name and email.");
    setBusy(true);
    try {
      const optionsJSON = await api.registerOptions({
        email: email.trim(),
        display_name: name.trim(),
        timezone: browserTimezone(),
        base_currency: browserCurrency(),
      });
      const attResp = await startRegistration({ optionsJSON: optionsJSON as never });
      const { user } = await api.registerVerify({ response: attResp });
      finishAuth(user);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    setError(null);
    setBusy(true);
    try {
      const optionsJSON = await api.loginOptions({ email: email.trim() || undefined });
      const asseResp = await startAuthentication({ optionsJSON: optionsJSON as never });
      const { user } = await api.loginVerify({ response: asseResp });
      finishAuth(user);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendMagic() {
    setError(null);
    if (!email.trim() || (mode === "create" && !name.trim())) {
      return setError(mode === "create" ? "Enter your name and email." : "Enter your email first.");
    }
    setBusy(true);
    try {
      const res = await api.magicRequest({
        email: email.trim(),
        display_name: mode === "create" ? name.trim() : undefined,
        timezone: browserTimezone(),
        base_currency: browserCurrency(),
      });
      setMagicSent(res.dev_link ?? "");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-10 text-center">
        <h1 className="font-display text-5xl font-black tracking-tight text-fg">Spendoff</h1>
        <p className="mt-3 text-muted">Log your spending. Settle it monthly. Spend less, win. 🏆</p>
      </div>

      <div className="mb-6 flex rounded-xl border border-line bg-surface p-1">
        {(["signin", "create"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
              setMagicSent(null);
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              mode === m ? "bg-accent text-accent-fg" : "text-muted"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {magicSent !== null ? (
        <div className="card p-5 text-center">
          <p className="font-semibold text-fg">Check your email 📬</p>
          <p className="mt-2 text-sm text-muted">We sent a one-time sign-in link to {email}.</p>
          {magicSent ? (
            <a href={magicSent} className="btn-primary mt-4 w-full py-3">
              Open dev link →
            </a>
          ) : null}
          <button onClick={() => setMagicSent(null)} className="mt-3 text-sm text-faint underline">
            Back
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {mode === "create" && (
            <div>
              <label className="label mb-1.5 block">Your name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" />
            </div>
          )}
          <div>
            <label className="label mb-1.5 block">Email</label>
            <input
              className="input"
              type="email"
              autoComplete="username webauthn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          {mode === "create" ? (
            <button onClick={createAccount} disabled={busy} className="btn-primary w-full py-3.5">
              {busy ? "Creating…" : "Create with passkey"}
            </button>
          ) : (
            <button onClick={signIn} disabled={busy} className="btn-primary w-full py-3.5">
              {busy ? "Signing in…" : "Sign in with passkey"}
            </button>
          )}

          <button onClick={sendMagic} disabled={busy} className="btn-ghost w-full py-3">
            Email me a link instead
          </button>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-faint">
        Passkeys use your device's Face ID / fingerprint. No passwords.
      </p>
    </div>
  );
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) {
    if (e.name === "NotAllowedError") return "Passkey prompt was dismissed. Try again.";
    return e.message;
  }
  return "Something went wrong.";
}
