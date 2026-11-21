import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/shared/brand";

export const metadata: Metadata = { title: `Support · ${BRAND.appName}`, description: `Help with ${BRAND.appName}: live translated calls.` };

export default function Support() {
  return (
    <main className="screen legal">
      <article>
        <p className="muted small">
          <Link href="/">← {BRAND.appName}</Link>
        </p>
        <h1>Support</h1>
        <p>
          Questions, problems or ideas: email <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>. We usually reply within two working days. Tell us your phone
          model and roughly when it happened, and we can usually find what went wrong.
        </p>

        <h2>Common questions</h2>
        <h3>How do I call someone?</h3>
        <p>Tap Start a call and send them the link. They open it in their browser and join, with no app or account needed. Each of you speaks your own language.</p>

        <h3>The other person can&rsquo;t hear me, or captions don&rsquo;t appear</h3>
        <ul>
          <li>Check that {BRAND.appName} is allowed to use the microphone (iPhone: Settings › {BRAND.appName}, or Settings › Safari › Microphone in the browser).</li>
          <li>Make sure you aren&rsquo;t muted, and that each person has chosen the language they speak.</li>
          <li>Captions need an internet connection. On a slow connection they arrive late rather than being lost.</li>
        </ul>

        <h3>A caption was translated wrongly</h3>
        <p>Open the conversation (the full transcript of the call) and tap &ldquo;Not right?&rdquo; next to that sentence. Only that sentence is saved, so we can improve translations.</p>

        <h3>Subscriptions and refunds</h3>
        <p>
          Purchases in the iPhone app are handled by Apple. Manage or cancel a subscription in Settings › your name › Subscriptions. For a refund, use
          reportaproblem.apple.com.
        </p>

        <h3>Deleting your data</h3>
        <p>
          We don&rsquo;t record calls. Your name, photo and Recent list are kept on your own phone; on the Me page, under Your data, you can clear them. To ask us to delete anything we hold, email
          us.
        </p>

        <p className="muted small">
          <Link href="/privacy">Privacy policy</Link> · <Link href="/terms">Terms of use</Link>
        </p>
      </article>
    </main>
  );
}
