# Accounts: plan for the App Store release

Status: **not built yet, on purpose.** Today "Me" lives only on the device, and
"Use on another phone" copies it between phones through a link (nothing on our servers).
This is the plan for when Simpatico is in the App Store and Play Store.

## What an account is for

- **The same "you" on every device**: name, gender, language, where you're from, your
  names and words, topics, caption settings. Exactly the `Transfer` object in
  `lib/profile.ts`, so the shape is already settled.
- **Subscriptions**: which plan you're on, whichever store you paid in.
- **Not** for calls: calls stay unrecorded, transcripts stay on the device, and someone you
  invite still joins from a link with no account.

## Sign-in

| Method | Why |
|---|---|
| Sign in with Apple | Required by Apple when an app offers other social sign-in (guideline 4.8); one tap on iPhone. |
| Sign in with Google | One tap on Android. |
| Email link (no password) | Everyone else, and the website. |

Guests can always call without signing in. Signing in is offered on "Me", never forced.

## Data (server)

Move from JSON files on the Fly volume to a managed Postgres (Supabase or Fly Postgres):

- `users`: id, apple_sub, google_sub, email, created_at, deleted_at
- `profiles`: user_id, data (the `Transfer` JSON), updated_at (last write wins, per field)
- `entitlements`: user_id, plan, source (app_store / play / web), expires_at

No call content in any table. "Not right?" reports stay anonymous and are not linked to
accounts.

## Flows

1. **First sign-in on a phone that already has a profile**: upload it (it becomes the
   account's profile). On a second phone, the account's profile replaces the local one,
   after asking, like "Use on another phone" does today.
2. **Change something**: saved on the phone straight away (as now), synced in the
   background; offline changes sync later.
3. **Delete account** (Apple requires it in the app): removes users, profiles and
   entitlements rows; the phone keeps its local copy until "Clear my profile".
4. **Sign out**: the phone keeps working as a guest with its local profile.

## Subscriptions

StoreKit 2 (iPhone) and Play Billing (Android) inside the apps, with server-side receipt
checks writing `entitlements`. The website can use Stripe later. Free minutes for guests
are counted per device until sign-in.

## Order of work (when the store apps exist)

1. Postgres + users/profiles tables, sign-in endpoints, session tokens.
2. "Sign in" on Me, upload/download of the profile, delete account.
3. TestFlight / Play internal testing with a few testers across two devices each.
4. Entitlements and the paywall.
5. Privacy policy and App Store privacy labels updated (account data, purchases).
