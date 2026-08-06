# Product

## Register

product

## Platform

web

## Users

Two siblings ribbing each other about spending is the archetype, designed from day one for N users in M battles — friends, roommates, a family group. They open the app on their phone, mid-errand, to log a spend in two taps. A secondary surface-audience exists on the landing page: a curious visitor sent a link by someone already competing.

## Product Purpose

A competitive personal-spending tracker (PWA). Everyone logs their own spending fast; at month's end the lowest spender wins, with a head-to-head breakdown, trends, and roast-y callouts. Success is the daily two-tap log habit and the month-end showdown people come back for.

## Positioning

It's not bill-splitting. Spending is personal; the competition is the point.

## Conversion & proof

Landing surface only (the app itself is the product register default).

- Primary CTA: create an account (passkey sign-up via /onboard). Secondary: sign in.
- The line a visitor remembers: "Spend less. Win the month."
- Belief ladder: this is a game, not a chore → logging really is two taps → my numbers stay private, only totals compete → it costs nothing to try.
- Proof on hand: the product itself — sanitized real screenshots (`output/marketing/raw/`, fictional personas maya/rohan/sana/Alex) and the live app one tap away.

## Brand Personality

Playful-competitive, dry, mechanical-warm. The world is a receipt: paper, tape perforations, mono numerals, a red SETTLED stamp. Trash talk delivered deadpan in small type. Never corporate-finance serious, never gamified-cartoon loud.

## Anti-references

Fintech dashboards (navy/gradient, big hero metrics), bill-splitting apps (Splitwise et al. — this is not that, and the copy says so), gamified savings apps with mascots and confetti, generic SaaS landing templates with card grids and eyebrow labels.

## Design Principles

- The receipt is the interface: every surface is paper, tape, ink, or stamp. New UI joins the paper world or it doesn't ship.
- Show the product, don't describe it: real screens beat illustrations; the app's own components (Tape, Stamp, mono tabular numerals) do the talking.
- Two taps or it's too many: friction anywhere in logging is a product bug.
- The showdown is the hook: month-end settlement, the stamp moment, and bragging rights get top billing.
- Competition without exposure: only totals and categories compete; notes and line items stay private by default.

## Accessibility & Inclusion

Body text ≥ 4.5:1 on paper/bg (the token system encodes this: `--faint` is for skippable meta only). Keyboard focus visible everywhere. Both sanctioned animations (print, stamp) are disabled under `prefers-reduced-motion`. Theme follows the device with an explicit in-app override.
