import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/shared/brand";

export const metadata: Metadata = { title: `Terms of use · ${BRAND.appName}` };

export default function Terms() {
  return (
    <main className="screen legal">
      <article>
        <p className="muted small">
          <Link href="/">← {BRAND.appName}</Link>
        </p>
        <h1>Terms of use</h1>
        <p className="muted small">Last updated {BRAND.policyUpdated}</p>

        <h2>Who we are</h2>
        <p>
          {BRAND.appName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides this service. By using {BRAND.appName}, on the web or in the app, you agree to these terms. If you
          don&rsquo;t agree, please don&rsquo;t use it. Contact: {BRAND.contactEmail}.
        </p>

        <h2>What {BRAND.appName} does</h2>
        <p>
          {BRAND.appName} lets people who speak different languages talk by video or voice, and face to face, with live captions translated by machine. The person you call
          doesn&rsquo;t need an account or the app.
        </p>

        <h2>Captions are machine translations</h2>
        <p>
          Captions are produced automatically by speech recognition and machine translation. They can be wrong, incomplete or late, and can miss tone or meaning. Don&rsquo;t
          rely on them where a mistake could cause harm: medical, legal, financial or safety matters, or emergencies. Use a qualified interpreter for those. {BRAND.appName} is
          not an emergency service.
        </p>

        <h2>Using it fairly</h2>
        <ul>
          <li>You must be at least 16, or use {BRAND.appName} with a parent or guardian.</li>
          <li>Don&rsquo;t use it to harass, threaten or harm anyone, to break the law, or to share content you have no right to share.</li>
          <li>Don&rsquo;t record or share other people&rsquo;s calls without their consent where the law requires it.</li>
          <li>Don&rsquo;t try to disrupt, overload, copy or reverse-engineer the service, or get around its limits.</li>
          <li>You can block and report people from within a call. We may suspend access that breaks these terms.</li>
        </ul>

        <h2>Your content</h2>
        <p>
          What you say and send stays yours. You let us process it only to run the service as described in our <Link href="/privacy">privacy policy</Link>: we don&rsquo;t record
          calls, and photos and videos sent in a call are deleted once everyone has left.
        </p>

        <h2>Plans and payments</h2>
        <ul>
          <li>{BRAND.appName} includes a free amount of caption time each month. Paid plans add more, as described in the app before you buy.</li>
          <li>In the iPhone app, purchases are made through your Apple account and billed by Apple. Subscriptions renew automatically until you cancel them in your Apple
            account settings, at least 24 hours before the renewal date. A free trial, where offered, becomes a paid subscription when it ends unless you cancel before.</li>
          <li>Refunds for purchases made through Apple are handled by Apple (reportaproblem.apple.com).</li>
          <li>Unused caption time doesn&rsquo;t carry over to the next period unless the app says otherwise.</li>
        </ul>

        <h2>Availability and changes</h2>
        <p>
          We work to keep {BRAND.appName} running well, but it depends on internet connections and outside providers, so it may sometimes be unavailable or slow. We may change,
          add or remove features. If we change these terms in a way that matters, we&rsquo;ll show it in the app and update the date above.
        </p>

        <h2>Your rights under consumer law</h2>
        <p>
          Nothing in these terms limits rights you have under the Australian Consumer Law or other consumer laws that can&rsquo;t be excluded. Where those laws allow, our
          liability for a failure of the service is limited to supplying the service again or refunding what you paid for the period affected, and we&rsquo;re not liable for
          indirect losses, or for decisions made on the basis of a machine translation.
        </p>

        <h2>Apple</h2>
        <p>
          If you use the iPhone app, these terms are between you and us, not Apple. Apple isn&rsquo;t responsible for the app or its content, has no obligation to provide support
          for it, and is a third-party beneficiary of these terms, able to enforce them against you. Apple&rsquo;s standard licensed application end user licence agreement also
          applies, except where these terms say otherwise.
        </p>

        <h2>Ending</h2>
        <p>You can stop using {BRAND.appName} at any time, and ask us to delete your data as described in the privacy policy.</p>

        <h2>Law</h2>
        <p>These terms are governed by the laws of {BRAND.governingLaw}, and the courts of {BRAND.governingLaw} can decide any dispute about them.</p>

        <p className="muted small">
          See also: <Link href="/privacy">Privacy policy</Link> · <Link href="/support">Support</Link>
        </p>
      </article>
    </main>
  );
}
