import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "../components/ui/button";
import { api } from "../lib/api";

export const Route = createFileRoute("/auth/magic")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : "" }),
  component: MagicConsume,
});

function MagicConsume() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!token) {
        setError("Missing sign-in token.");
        return;
      }
      try {
        const { user } = await api.magicVerify({ token });
        qc.setQueryData(["me"], user);
        navigate({ to: "/" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "This link is invalid or expired.");
      }
    })();
  }, [token, navigate, qc]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      {error ? (
        <>
          <p className="text-lg font-semibold text-stamp">{error}</p>
          <a href="/onboard" className={buttonVariants({ size: "lg", className: "mt-5" })}>
            Back to sign in
          </a>
        </>
      ) : (
        <p className="animate-pulse text-muted">Signing you in…</p>
      )}
    </div>
  );
}
