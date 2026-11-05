# Simpatico for iPhone and Android

The apps are thin native shells (Capacitor 8) around the same Simpatico web app that runs on
Fly. Calls, captions, translations and every screen come from the server, so improvements
reach the website and both apps at once, with no store update. A store update is only needed
when this native part changes (permissions, icon, the plugins below).

What the shells add over the website:

| | iPhone | Android |
|---|---|---|
| Store listing, home-screen icon, opens full screen | ✓ | ✓ |
| Voice Isolation picker ("Caption settings › iPhone voice isolation") | ✓ | – |
| Loudspeaker / headset audio routing for calls | ✓ | ✓ |
| Native share sheet for call links | ✓ | ✓ |
| Call links open straight in the app (after the domain steps below) | ✓ | ✓ |
| Friendly offline screen | ✓ | ✓ |

The web app recognises the shells by the `SimpaticoApp/1` user-agent suffix, so it never
mistakes them for an in-app browser (Instagram/WhatsApp) and never shows "install the app".

## One-time accounts

- **Apple Developer Program**: US$99 / year. Needed for TestFlight and the App Store.
- **Google Play Console**: US$25 once.
- Optional, if you have no Mac: a cloud build service with macOS machines (for example
  Codemagic or Ionic Appflow) builds and uploads the iPhone app from this folder.

## Build

```bash
cd mobile
npm install
npx cap sync
```

iPhone (on a Mac with Xcode 16 or newer):

```bash
npx cap open ios
```

In Xcode: select the **App** target › Signing & Capabilities › choose your team. Then
Product › Archive › Distribute App › TestFlight. Test on a real iPhone (the simulator has no
camera).

Android (Android Studio, or `./gradlew bundleRelease` in `android/` with the Android SDK):

```bash
npx cap open android
```

Build › Generate Signed App Bundle › upload the `.aab` to Play Console (internal testing first).

## Point the apps at the final domain

`capacitor.config.ts` loads `https://talk-calls.fly.dev`. When `simpaticocall.app` (or the
domain you choose) is registered and pointed at the Fly app:

```bash
SIMPATICO_URL=https://simpaticocall.app npx cap sync
```

### Links that open in the app (universal links / app links)

1. iPhone: Xcode › Signing & Capabilities › **+ Associated Domains** › add
   `applinks:simpaticocall.app`. The website must then serve
   `/.well-known/apple-app-site-association` naming your Team ID and `app.simpaticocall`.
2. Android: the intent filter is already in `AndroidManifest.xml`. The website must serve
   `/.well-known/assetlinks.json` with the SHA-256 fingerprint of the Play app-signing key
   (Play Console › Setup › App signing).

Send me the Team ID and the fingerprint and the server will serve both files.

## Store review notes

- Apple rejects apps that are only a website in a frame (guideline 4.2). This one adds the
  iPhone microphone-mode picker, loudspeaker routing, the native share sheet and app links,
  and is built for calls rather than browsing. Mention these in the review notes.
- Camera and microphone prompts use the texts in `ios/App/App/Info.plist`.
- Privacy: the App Store privacy labels should match `/privacy` (audio is processed for
  captions, nothing recorded, no tracking). Give reviewers a call link so they can test,
  and say that a second device or browser is needed to see the other side.
- Subscriptions sold inside the iPhone app must use Apple's in-app purchase (15% fee for the
  small-business programme); Android uses Google Play Billing (15%).
- Not verified here: this project was set up on Linux, where neither app can be built. The
  first build on a Mac / Android Studio may need small fixes.
