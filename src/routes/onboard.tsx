import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, buttonVariants } from "../components/ui/button";
import { Field } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { Tape } from "../components/ui/tape";
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
        <h1 className="font-mono text-4xl font-bold uppercase tracking-[0.18em] text-ink">Spendoff</h1>
        <p className="mt-3 text-muted">Log your spending. Settle it monthly. Spend less, win. 🏆</p>
      </div>

      <div className="mb-6 flex rounded-xl border border-line bg-paper p-1">
        {(["signin", "create"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
              setMagicSent(null);
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              mode === m ? "bg-ink text-paper" : "text-muted"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {magicSent !== null ? (
        <Tape className="p-5 pb-7 text-center">
          <p className="font-semibold text-ink">Check your email 📬</p>
          <p className="mt-2 text-sm text-muted">We sent a one-time sign-in link to {email}.</p>
          {magicSent ? (
            <a href={magicSent} className={buttonVariants({ size: "lg", full: true, className: "mt-4" })}>
              Open dev link →
            </a>
          ) : null}
          <button onClick={() => setMagicSent(null)} className="mt-3 text-sm text-faint underline">
            Back
          </button>
        </Tape>
      ) : (
        <div className="space-y-3">
          {mode === "create" && (
            <Field label="Your name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" />
            </Field>
          )}
          <Field label="Email">
            <Input
              type="email"
              autoComplete="username webauthn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </Field>

          {error && <p className="text-sm text-stamp">{error}</p>}

          {mode === "create" ? (
            <Button size="lg" full onClick={createAccount} disabled={busy}>
              {busy ? "Creating…" : "Create with passkey"}
            </Button>
          ) : (
            <Button size="lg" full onClick={signIn} disabled={busy}>
              {busy ? "Signing in…" : "Sign in with passkey"}
            </Button>
          )}

          <Button variant="secondary" full onClick={sendMagic} disabled={busy}>
            Email me a link instead
          </Button>
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
