# Launch steps and decisions

Kept in the repository so they survive beyond any one chat. Last updated 21 November 2026.

## Decisions
- Apple Developer account: **individual** (no company yet).
- Legal owner: **Max Senica** (individual; kept here only, never on public pages, which say "Simpatico"). Support email: **simpaticosupport@gmail.com**.
- Public pages name providers by role only (cloud hosting, speech recognition, AI translation, connection helpers). The real list, for a regulator on request: Fly.io (hosting: fra calls; syd, iad, lax, gru, jnb, sin, nrt pages), Soniox (speech), Anthropic (translation), Cloudflare and Google (STUN).
- Servers (24 Nov 2026): Frankfurt (calls and pages) and Sydney (pages) running. Six more page servers are set up but **parked** (stopped and cordoned, no traffic, near-zero cost: only their 1 GB disks, about US$0.15 a month each): iad, lax, gru, jnb, sin, nrt. Deploys go only to fra and syd (scripts/deploy-prebuilt.sh). To turn them on: `fly machine uncordon <id>` and `fly machine start <id>` for each, then deploy once with `DEPLOY_REGIONS=fra,syd,iad,lax,gru,jnb,sin,nrt`. Ids: iad 8111ee1b47d408, lax 874599c63427e8, gru d8d1390c507658, jnb 8303d6a72d2698, sin 48ee713cde6658, nrt e82667dc430258.

## Privacy to-do (agreed 24 Nov 2026, to do soon)
Max wants nothing in the app that leads back to him personally. Done: public pages say "Simpatico", providers named only by role, no server locations. Still to do:
1. **Company:** set up a Pty Ltd (or at least register "Simpatico" as a business name under his ABN) so a business, not a person, stands behind the privacy policy and terms.
2. **Apple organisation account:** an individual account shows "Max Senica" as the seller on the App Store. Moving to an organisation account (needs the company and a free D-U-N-S number) shows the company instead. Do this before the public launch.
3. **Own domain:** talk-calls.fly.dev names the hosting company. Buy the domain, then point the app, links and bio links at it.
4. **Support email:** simpaticosupport@gmail.com is fine for now; move to support@<domain> with the domain.
(The GitHub repository stays public by choice, for easy updates.)
- Terms of use (/terms) under **Queensland** law; support page (/support); privacy (/privacy).
- App name **Simpatico**, bundle ID **app.simpatico** (no "call").
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
  - Soniox streams open when a call or In person starts and close after 15 s without speech.
  - Live previews are requested every couple of words.
- Phrasebook daily job: drafts with Claude Sonnet 5.5, checks with Claude Opus 5.5.

## TestFlight: Max's steps
1. Enrol in the Apple Developer Program as an individual (US$99/year). **Done 21 Nov 2026.**
2. **Done 21 Nov 2026** (Team ID P5C9YZ5CFB). App Store Connect › My Apps › + › New App: name **Simpatico**, English (Australia), bundle ID **app.simpatico** (add it under Certificates, Identifiers & Profiles › Identifiers if missing), SKU **simpatico**.
3. Users and Access › Integrations › App Store Connect API › Team Keys › +, role **Admin** (needed so the build can create the signing certificate); download the key file (once only).
4. GitHub › Simpatico › Settings › Secrets and variables › Actions › New repository secret: **APPSTORE_KEY_ID**, **APPSTORE_ISSUER_ID**, **APPSTORE_KEY_P8** (the whole .p8 file text). Never in chat.
5. **First build uploaded 21 Nov 2026 (version 1.0, build 4).** GitHub › Actions › "iPhone build to TestFlight" › Run workflow (Claude can start it too); it appears under TestFlight about 30 minutes later. Encryption question: standard encryption only.
6. Install the TestFlight app on the iPhone; tap Install on Simpatico.
7. TestFlight › External Testing › + group: add Ezgi and friends by email or public link. Apple reviews the first external build (about a day).

## Claude's side once the account exists
- GitHub Actions build on macOS (Capacitor iOS shell in `mobile/`), signing via the App Store Connect API key, upload to TestFlight.
- Then: native push + CallKit ringing, in-app purchases (StoreKit) with the plans above, Sentry crash reporting, Sydney + Frankfurt servers.
