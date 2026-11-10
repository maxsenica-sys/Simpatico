import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/shared/brand";

export const metadata: Metadata = { title: `Privacy · ${BRAND.appName}` };

const providers = [
  { name: "Fly.io", role: "Runs our server (Frankfurt, Germany). Handles the connection between your browser and us.", url: "https://fly.io/legal/privacy-policy/" },
  {
    name: "Soniox",
    role: "Turns your speech into text and translates it, live. Its policy says real-time requests are processed transiently, not stored, and never used to train its models.",
    url: "https://soniox.com/policies/privacy-policy",
  },
  {
    name: "Anthropic (Claude)",
    role: "Rewrites each finished sentence into natural wording in the other person's language. Its commercial terms say it may not train models on this content.",
    url: "https://www.anthropic.com/legal/commercial-terms",
  },
  { name: "Cloudflare and Google", role: "Public servers that help the two devices find each other (STUN). They see your IP address, not your call.", url: "https://www.cloudflare.com/privacypolicy/" },
];

export default function Privacy() {
  return (
    <main className="screen legal">
      <article>
        <p className="muted small">
          <Link href="/">← {BRAND.appName}</Link>
        </p>
        <h1>Privacy policy</h1>
        <p className="muted small">Last updated {BRAND.policyUpdated}</p>

        <h2>In short</h2>
        <ul>
          <li>We don't record your calls. No audio, video or transcript is saved by us.</li>
          <li>Your video and voice go directly between the two devices, encrypted.</li>
          <li>To make captions, the words you speak are sent to our speech and translation providers while you talk, and then discarded by us.</li>
          <li>If you tap &ldquo;Not right?&rdquo; on a caption, that one sentence and its translation are saved so we can improve translations. Nothing else you say is kept.</li>
          <li>The person you call needs no account. We don't use cookies, ads or tracking.</li>
        </ul>

        <h2>Who we are</h2>
        <p>
          {BRAND.appName} is run by {BRAND.operator}, who is responsible for your data (the &ldquo;controller&rdquo; under the EU GDPR and Türkiye&rsquo;s KVKK). Contact: {BRAND.contactEmail}.
        </p>

        <h2>What happens to your data during a call</h2>
        <h3>Video and voice</h3>
        <p>
          Your camera and microphone are sent directly from your device to the other person&rsquo;s device using WebRTC, which encrypts them end to end between the two
          browsers. Our server only passes on the short messages the two devices need to find each other. If a direct connection isn&rsquo;t possible, the encrypted media may
          pass through a relay server, which cannot read it.
        </p>
        <h3>Your speech, for captions</h3>
        <p>
          While you are speaking and the other person is on the call, your browser also sends your microphone audio to our server, which streams it to Soniox to be
          transcribed and translated. Silence and audio picked up while you are muted are not sent. Each finished sentence (as text), with the last few sentences of the
          conversation for context, is sent to Anthropic&rsquo;s Claude to produce a natural translation. The result is shown to the other person as captions.
        </p>
        <h3>Captions and transcript</h3>
        <p>
          The transcript you can open during a call lives only in your browser and is gone when you close the page. To keep translations consistent, our server holds the
          most recent sentences of the conversation in memory while the call room exists. It is never written to disk and is deleted when the room closes.
        </p>
        <h3>Reporting a translation</h3>
        <p>
          In the transcript, each caption you received has a &ldquo;Not right?&rdquo; button. If you tap it, our server saves that one sentence: what was said, the
          translation you saw, and the two languages. No names, audio or other parts of the conversation are saved with it. We use these reports to teach the app slang,
          names and phrasing it gets wrong. Only tap it if you are happy for that sentence to be kept; you can ask us to delete reports at {BRAND.contactEmail}.
        </p>
        <h3>Your name and gender</h3>
        <p>
          The name and gender you choose when joining are shown to (name) or used for (gender, for grammar in languages such as Russian or Arabic) the other people in the
          call. They are saved in your own browser for next time, and held by our server only while you are in the call.
        </p>
        <h3>Technical logs</h3>
        <p>
          Our server logs events such as the call room code, the languages chosen, whether the connection was direct, timings and errors. Logs contain no audio, video or
          words of your conversation. They are kept by our hosting provider for a short period for troubleshooting.
        </p>
        <h3>On your device</h3>
        <p>
          Your browser stores your language, name, gender and caption settings, and a random ID for each call link, so a reload rejoins the same call. Nothing else is
          stored, and nothing is shared with advertisers.
        </p>

        <h2>Providers we use</h2>
        <p>These companies process data on our behalf only to run the service. Some of them process data outside the EU and Türkiye, including in the United States.</p>
        <ul>
          {providers.map((p) => (
            <li key={p.name}>
              <a href={p.url} target="_blank" rel="noreferrer">
                {p.name}
              </a>
              : {p.role}
            </li>
          ))}
        </ul>

        <h2>Why we process it</h2>
        <p>
          We process your speech and connection data because you ask us to: making a captioned call is the service (performance of a contract). We keep technical logs
          because we have a legitimate interest in keeping the service working and secure.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask to access, correct or delete your data, or object to how it is used, by writing to {BRAND.contactEmail}. Because we don&rsquo;t store recordings or
          transcripts, there is usually nothing linked to you to hand over or delete beyond short-lived logs. You can also complain to your data protection authority: in
          Türkiye the KVKK Board, in the EU your national authority, in Australia the OAIC.
        </p>

        <h2>Captions are machine translations</h2>
        <p>Captions are produced by software and can be wrong. Don&rsquo;t rely on them for medical, legal or other decisions where a certified interpreter is needed.</p>

        <h2>Children</h2>
        <p>The service is not meant for children under 16 without a parent or guardian.</p>

        <h2>Changes</h2>
        <p>If we change this policy we will update the date at the top. Material changes will be shown in the app.</p>
      </article>
    </main>
  );
}
