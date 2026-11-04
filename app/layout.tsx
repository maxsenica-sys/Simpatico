import type { Metadata, Viewport } from "next";
import { BRAND } from "@/shared/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND.appName,
  description: "Video calls with live, idiomatic translated captions. Hear their real voice, read them in your language.",
  applicationName: BRAND.appName,
  appleWebApp: { capable: true, title: BRAND.appName, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
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
