# Launch steps and decisions

Kept in the repository so they survive beyond any one chat. Last updated 15 November 2026.

## Decisions
- Apple Developer account: **individual** (no company yet).
- Terms of use: **Queensland** law. Still needed from Max: **support email** and **full legal name**.
- Long-speech captions: **"Make room"** is the default (smaller text, video moves up); "Scroll" stays as an option.
- Pricing (each person pays for the captions they read):
  - Free: **20 minutes** of captions a month, per person.
  - Plus: **A$8.99 / US$5.99 a month** per person, 15 hours of captions; **A$69.99 / US$44.99 a year**.
  - Top-up: A$5.99 / US$3.99 for 5 extra hours.
- Phrasebook daily job: drafts with Claude Sonnet 5.5, checks with Claude Opus 5.5.

## TestFlight: Max's steps
1. Enrol in the Apple Developer Program as an individual (US$99/year). Approval usually 1–2 days.
2. App Store Connect › My Apps › + › New App: name **Simpatico**, English (Australia), bundle ID **app.simpaticocall** (add it under Certificates, Identifiers & Profiles › Identifiers if missing), SKU **simpatico**.
3. Users and Access › Integrations › App Store Connect API › +, role **App Manager**; download the key file (once only).
4. GitHub › Simpatico › Settings › Secrets and variables › Actions: add the key ID, issuer ID and key file text (names given by Claude). Never in chat.
5. Claude starts the first build; it appears under TestFlight about 30 minutes later. Encryption question: standard encryption only.
6. Install the TestFlight app on the iPhone; tap Install on Simpatico.
7. TestFlight › External Testing › + group: add Ezgi and friends by email or public link. Apple reviews the first external build (about a day).

## Claude's side once the account exists
- GitHub Actions build on macOS (Capacitor iOS shell in `mobile/`), signing via the App Store Connect API key, upload to TestFlight.
- Then: native push + CallKit ringing, in-app purchases (StoreKit) with the plans above, Sentry crash reporting, Sydney + Frankfurt servers.
