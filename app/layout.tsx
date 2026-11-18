import type { Metadata, Viewport } from "next";
import { BRAND } from "@/shared/brand";
import "./globals.css";

/** The site's own address, for link previews (set SITE_URL when the real domain is live). */
const SITE = process.env.SITE_URL ?? "https://talk-calls.fly.dev";
const DESCRIPTION = `${BRAND.tagline} Live translated captions on video calls. No app, no account.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: BRAND.appName,
  description: DESCRIPTION,
  // What WhatsApp, iMessage and others show when a link is shared: a picture, a title, a line.
  openGraph: { type: "website", siteName: BRAND.appName, title: `${BRAND.appName}: ${BRAND.tagline}`, description: DESCRIPTION, images: [{ url: "/og.png", width: 1200, height: 630, alt: `${BRAND.appName}: ${BRAND.tagline}` }] },
  twitter: { card: "summary_large_image", title: `${BRAND.appName}: ${BRAND.tagline}`, description: DESCRIPTION, images: ["/og.png"] },
  applicationName: BRAND.appName,
  appleWebApp: { capable: true, title: BRAND.appName, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  // Plain image files at the standard addresses: iPhones are fussy about Home Screen icons and
  // fall back to a screenshot of the page when the icon isn't a simple .png they can fetch.
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon-167.png", sizes: "167x167", type: "image/png" },
      { url: "/apple-touch-icon-152.png", sizes: "152x152", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0d10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
