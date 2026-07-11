# Security Policy

SpendOff is a personal project, but it runs a live site at [spendoff.us](https://spendoff.us) with real accounts and real data. Reports are genuinely welcome.

## Reporting a vulnerability

**Please don't open a public issue for a security problem.**

Use GitHub's private vulnerability reporting instead:

1. Go to the [Security tab](https://github.com/HlaKarki/spendoff/security)
2. Click **Report a vulnerability**

That opens a private thread visible only to the maintainer.

## What to expect

This is maintained by one person, in their spare time — so no SLA, and no bug bounty. That said:

- I'll acknowledge a report within about a week.
- If it's a real issue affecting live users, fixing it takes priority over whatever else is in flight.
- I'm happy to credit you in the fix, unless you'd rather I didn't.

## Scope

**In scope**

- The live app at `spendoff.us`
- The frontend code in this repository — including the service worker, the offline queue, and session handling

**Out of scope**

- The backend API is a **separate, private repository**. It's still worth reporting anything you find through the live site — just note that you won't be able to read that source.
- Denial of service, volumetric, or automated-scanner findings without a demonstrated impact
- Anything requiring physical access to a user's unlocked device

## Testing guidelines

If you find a way in, these are the limits — please stay inside them:

- Test only against accounts you create yourself.
- Do not access, modify, or delete data belonging to anyone else. Confirming a vulnerability on a second account of your own is enough; you don't need to touch real data to demonstrate impact.
- Stop as soon as the issue is confirmed, and report it. Don't keep exploring to see how far it reaches.
- No automated scanners, brute-forcing, or load testing against the live site.

Report in good faith and stay within these limits, and I won't pursue anything over it.
