# Launch steps and decisions

Kept in the repository so they survive beyond any one chat. Last updated 16 November 2026.

## Decisions
- Apple Developer account: **individual** (no company yet).
- Terms of use: **Queensland** law. Still needed from Max: **support email** and **full legal name**.
- Long-speech captions: **"Make room"** is the default (smaller text, video moves up); "Scroll" stays as an option.
- Pricing (per person: each person pays for the captions they read):
  - Free: **20 minutes** of captions a month.
  - Plus: **A$9.99 / US$6.99 a month** for 10 hours; **A$89.99 / US$59.99 a year**. **7-day free trial.**
  - Max: **A$17.99 / US$12.99 a month** for 30 hours; **A$159.99 / US$109.99 a year**.
  - Top-up: **A$5.99 / US$3.99** for 5 extra hours.
  - Built with StoreKit (plus caption-minute metering on the server) once the Apple account exists.
- Running costs (16 Nov 2026, after the cost cuts): about **US$0.20 per person per caption-hour**.
  - Soniox only transcribes; Claude writes every subtitle.
  - Soniox's own translation switches back on automatically for 5 minutes if Claude fails 4 times in a row.
  - Soniox streams close after 6 s without speech.
  - Live previews are requested every couple of words.
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
