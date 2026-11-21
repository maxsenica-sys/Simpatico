import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Simpatico for iPhone and Android: a native shell around the same web app, so every
 * improvement ships to the website and both apps at once (no app-store update needed for
 * call or caption changes). The shell adds what a browser can't: the iPhone microphone-mode
 * picker (Voice Isolation), the native share sheet, links that open straight in the app,
 * and the App Store / Play Store listing.
 *
 * SERVER_URL: where the app lives. Change to the final domain (e.g. https://simpatico.app)
 * once it is registered and pointed at the Fly app.
 */
const SERVER_URL = process.env.SIMPATICO_URL ?? "https://talk-calls.fly.dev";

const config: CapacitorConfig = {
  appId: "app.simpatico",
  appName: "Simpatico",
  webDir: "www",
  // The web app sees this and knows it is inside our app, not an in-app browser.
  appendUserAgent: "SimpaticoApp/1",
  backgroundColor: "#0b0d10",
  server: {
    url: SERVER_URL,
    cleartext: false,
    // Shown when the phone is offline or the server can't be reached.
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "never",
    // Calls run in the web view: let video play inline and audio start without a tap.
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
