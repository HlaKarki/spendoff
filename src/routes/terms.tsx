import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Tape } from "../components/ui/tape";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — Spendoff" },
      {
        name: "description",
        content:
          "The terms for using Spendoff: your account, acceptable use, how battles settle, and what happens if the rules are broken.",
      },
    ],
  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function Email() {
  return (
    <a href="mailto:support@spendoff.us" className="font-medium text-accent underline underline-offset-2">
      support@spendoff.us
    </a>
  );
}

function TermsPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-bg px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link
        to="/"
        className="font-mono text-xs font-semibold uppercase tracking-wide text-faint transition hover:text-muted"
      >
        ← Spendoff
      </Link>

      <Tape className="mt-4 pt-7">
        <h1 className="font-mono text-xl font-bold uppercase tracking-wide text-ink">Terms of Service</h1>
        <p className="mt-1 font-mono text-xs text-faint">Effective July 25, 2026</p>

        <p className="mt-5 text-sm leading-relaxed text-muted">By using Spendoff, you agree to these terms.</p>

        <Section title="What Spendoff is">
          <p>
            Spendoff is a free expense-tracking app with friendly monthly spending battles between people you invite.
          </p>
          <p>Spendoff is informational. It is not financial advice.</p>
        </Section>

        <Section title="Your account">
          <p>
            Give us accurate information, and keep your account to yourself — one person per account. You're responsible
            for the activity on your account.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            No unlawful, abusive, or hateful content — not in battle names, not in display names, not anywhere else.
            Don't harass other players, and don't interfere with or attempt to break the service.
          </p>
          <p>
            If someone crosses the line, report it in-app (Report a player) or email <Email />. We may remove content or
            suspend accounts that violate these terms.
          </p>
        </Section>

        <Section title="Battles">
          <p>
            Standings and results are computed from what players log. A month's result settles when the month closes,
            and once settled it's final.
          </p>
          <p>Battle owners control the win rule and the invite code. Share invite codes at your own discretion.</p>
        </Section>

        <Section title="Your content">
          <p>
            Your content is yours. You grant Spendoff the license needed to host and process it to run the service —
            including showing battle standings to the other players, as described in the privacy policy.
          </p>
        </Section>

        <Section title="Ending things">
          <p>
            You can stop using Spendoff or delete your account at any time. We may suspend or terminate accounts that
            violate these terms.
          </p>
        </Section>

        <Section title="Disclaimers">
          <p>
            Spendoff is provided "as is", without warranties. To the extent permitted by law, our liability is limited.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            We may update these terms; continued use after an update means you accept the new version. Material changes
            get a new effective date on this page.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms? Email <Email />.
          </p>
        </Section>
      </Tape>
    </div>
  );
}
