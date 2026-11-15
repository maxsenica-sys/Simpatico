import type { Metadata, Viewport } from "next";
import { BRAND } from "@/shared/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND.appName,
  description: `${BRAND.tagline} Live translated captions on video calls. No app, no account.`,
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
