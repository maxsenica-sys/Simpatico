import type { Metadata } from "next";
import { LangRoot } from "@/components/LangRoot";
import { Room } from "@/components/Room";
import { BRAND } from "@/shared/brand";

// A call link shared in WhatsApp or iMessage: say what it is, so it doesn't look like spam.
const TITLE = `You're invited to a call on ${BRAND.appName}`;
const TEXT = "Tap to join. You each speak your own language and read live translated captions. No app or account needed.";
export const metadata: Metadata = {
  title: TITLE,
  description: TEXT,
  openGraph: { title: TITLE, description: TEXT, images: [{ url: "/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: TEXT, images: ["/og.png"] },
  robots: { index: false },
};

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <LangRoot>
      <Room code={code.toLowerCase()} />
    </LangRoot>
  );
}
