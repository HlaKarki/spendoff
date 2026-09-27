import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Tape } from "../components/ui/tape";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Spendoff" },
      {
        name: "description",
        content:
          "How Spendoff handles your data: what we collect, what other players in a battle can see, and how to delete your account.",
      },
    ],
  }),
  component: PrivacyPage,
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

function PrivacyPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-bg px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link
        to="/"
        className="font-mono text-xs font-semibold uppercase tracking-wide text-faint transition hover:text-muted"
      >
        ← Spendoff
      </Link>

      <Tape className="mt-4 pt-7">
        <h1 className="font-mono text-xl font-bold uppercase tracking-wide text-ink">Privacy Policy</h1>
        <p className="mt-1 font-mono text-xs text-faint">Effective July 25, 2026</p>

        <p className="mt-5 text-sm leading-relaxed text-muted">
          Spendoff is an expense-tracking app run by Spendoff. This page explains what we collect, who can see it, and
          what you control. Questions? Email <Email />.
        </p>

        <Section title="What we collect">
          <p>
            Your account: an email address, a display name, your timezone, your base currency, and an account ID we
            generate for you.
          </p>
          <p>
            What you log: expenses — an amount, a currency, a category, a date, and an optional note. That's the whole
            list.
          </p>
        </Section>

        <Section title="Signing in">
          <p>
            Spendoff signs you in with passkeys or one-time email codes and magic links. A passkey is a public-key
            credential — we never store a password, because there isn't one.
          </p>
          <p>
            On the web, your session lives in a first-party cookie. In the mobile app, a session token is kept in your
            device's secure storage (iOS Keychain / Android Keystore).
          </p>
        </Section>

        <Section title="What other players can see">
          <p>
            Battles are shared by design: the battle's name, who's in it, and each player's monthly standings totals are
            visible to the other players in that battle.
          </p>
          <p>
            Your expense history is shared with a battle only if you explicitly opt in — and even then, shared history
            never includes your notes. Notes are never visible to anyone but you.
          </p>
        </Section>

        <Section title="Notifications">
          <p>
            Notifications are optional. If you turn them on, we store a push token and your device platform so we can
            deliver reminders and battle notifications, relayed through Expo's push service and Apple or Google. Turning
            notifications off stops this, and the token is removed when you sign out.
          </p>
        </Section>

        <Section title="Analytics">
          <p>
            The web app uses PostHog for pageview and feature-usage analytics. Profiles are created only for signed-in
            users, linked to your account ID, and used only to improve Spendoff. The mobile app contains no analytics
            SDK at all.
          </p>
          <p>We don't run ads, we don't sell your data, and we don't track you across other sites or apps.</p>
        </Section>

        <Section title="Where your data lives">
          <p>
            Spendoff runs on Cloudflare, which hosts the application and its databases. We also use an email delivery
            provider to send sign-in codes and magic links, PostHog for web analytics, and Expo, Apple, and Google to
            deliver push notifications.
          </p>
          <p>
            The app also keeps an offline replica of your data on your own device, so it works without a connection.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            You can delete your account any time in the app under Profile → Danger zone. That deletes your data from our
            servers and wipes the local replica on that device. You can also email <Email /> and we'll do it for you.
          </p>
        </Section>

        <Section title="Children">
          <p>Spendoff is not directed at children under 13.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>If this policy changes, we'll post the update on this page with a new effective date.</p>
        </Section>

        <Section title="Contact">
          <p>
            Anything unclear, or a request we haven't covered? Email <Email />.
          </p>
        </Section>
      </Tape>
    </div>
  );
}
