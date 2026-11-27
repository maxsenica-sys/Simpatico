import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/shared/brand";
import { KEEP_BY_DEFAULT, RECOVERY_DAYS } from "@/lib/saved";

export const metadata: Metadata = { title: `Privacy · ${BRAND.appName}` };

// Providers are named by what they do, not who they are (that list is kept privately and given to a
// data protection authority on request).
const providers = [
  { name: "Cloud hosting", role: "Runs our servers and carries the connection between your device and us." },
  { name: "Speech recognition", role: "Turns your speech into text, live. Requests are processed as they happen, not stored, and not used to train its models." },
  { name: "AI translation", role: "Rewrites each finished sentence into natural wording in the other person's language. It may not train its models on this content." },
  { name: "Connection helpers", role: "Public servers that help the two devices find each other. They see your IP address, not your call." },
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
          <li>We don't record your calls. No audio, video or transcript of the call is saved by us.</li>
          <li>Your video and voice go directly between the two devices, encrypted.</li>
          <li>To make captions, the words you speak are sent to our speech and translation providers while you talk, and then discarded by us.</li>
          <li>If you tap &ldquo;Not right?&rdquo; on a caption, that one sentence and its translation are saved so we can improve translations. Nothing else you say is kept.</li>
          <li>Photos and videos you send in a call&rsquo;s messages are kept on our server only until everyone has left the call, then deleted.</li>
          <li>The person you call needs no account. We don't use cookies, ads or tracking.</li>
        </ul>

        <h2>Who we are</h2>
        <p>
          {BRAND.appName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is responsible for your data (the &ldquo;controller&rdquo; under the EU GDPR and Türkiye&rsquo;s KVKK). Contact: {BRAND.contactEmail}.
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
          While you are speaking and the other person is on the call, your browser also sends your microphone audio to our server, which streams it to our speech recognition provider to be
          transcribed. Silence and audio picked up while you are muted are not sent. Each finished sentence (as text), with the last few sentences of the
          conversation for context, is sent to our AI translation provider to produce a natural translation. The result is shown to the other person as captions.
        </p>
        <h3>Captions and transcript</h3>
        <p>
          The transcript you can open during a call lives only on your device (see &ldquo;Recovery copies&rdquo; below). To keep translations consistent, our server holds the
          most recent sentences of the conversation in memory while the call room exists. It is never written to disk and is deleted when the room closes.
        </p>
        <h3>Recovery copies and keeping your conversations</h3>
        <p>
          So that a flat battery, a crash or a closed app cannot lose a conversation, its words are written to the app&rsquo;s storage on your own device
          while it runs, in both languages. This recovery copy never leaves your device. If you do not choose to keep it, it deletes itself after{" "}
          {RECOVERY_DAYS} days, and you can delete it sooner on the Me page.
        </p>
        <p>
          You choose whether conversations are kept (Me page, &ldquo;Keep my conversations on this phone&rdquo;, or the tick box when a conversation ends).
          {KEEP_BY_DEFAULT ? "For now this is on until you turn it off." : "It is off unless you turn it on."} When it is on, your calls and In person
          conversations stay on your device until you delete them, so you can read them again or save them as a file. In the iPhone app, kept conversations are also written as text files in the app&rsquo;s own folder on your phone, which your phone&rsquo;s
          backups may include. None of this is stored on our servers. &ldquo;Clear my profile&rdquo; removes all of it. Tell the people you talk to if you
          keep a copy.
        </p>
        <h3>Reporting a translation</h3>
        <p>
          In the transcript, each caption you received has a &ldquo;Not right?&rdquo; button. If you tap it, our server saves that one sentence: what was said, the
          translation you saw, and the two languages. No names, audio or other parts of the conversation are saved with it. We use these reports to teach the app slang,
          names and phrasing it gets wrong. Only tap it if you are happy for that sentence to be kept; you can ask us to delete reports at {BRAND.contactEmail}.
        </p>
        <h3>Your profile (&ldquo;Me&rdquo;)</h3>
        <p>
          Your name, gender, where you&rsquo;re from, the names and words you add, your usual topics and caption settings are saved only in your own browser or app on
          this device. We have no account for you. When you join a call, your name is shown to the other people, and the rest is sent to our server and held in memory
          only while you are in the call: gender is used for grammar in languages such as Russian or Arabic, and where you&rsquo;re from, your words and topics help
          speech recognition spell your words and the translation understand your slang. Your words and topics are also given to our speech recognition provider (as recognition hints) and
          our AI translation provider (with the sentence being translated). Nothing of your profile is stored by us after the call. &ldquo;Clear my profile&rdquo; removes it from your
          device.
        </p>
        <h3>Profile photo and Recent</h3>
        <p>
          If you add a profile photo, it is kept only on your device. During a call it is sent directly from your device to the other people&rsquo;s devices over the
          call&rsquo;s own encrypted connection; it does not pass through or get stored on our servers (if a direct connection isn&rsquo;t possible, it travels encrypted
          through a relay that cannot read it, the same as your video). The &ldquo;Recent&rdquo; list on the home screen (the names, languages, call times and photos of
          people you have called) is likewise kept only on your device. Removing someone from Recent, removing your photo, or &ldquo;Clear my profile&rdquo; deletes it
          from your device; a photo you have already shared stays on the other person&rsquo;s device until they remove you from their Recent or clear their profile.
        </p>
        <h3>Photos and videos in a call&rsquo;s messages</h3>
        <p>
          A photo or video you send from a call&rsquo;s messages goes to our server (encrypted on the way) and from there to the other people in that call. Photos are
          made smaller on your device first. It is stored on the server&rsquo;s temporary disk, never on its permanent storage, under a random link that only the people in
          the call are given, and it is deleted as soon as everyone has left the call (and whenever the server restarts). Anyone in the call can save a copy to their own
          device; a copy they save is theirs to keep. We don&rsquo;t look at, scan or keep what you send.
        </p>
        <h3>Moving to a new phone or icon</h3>
        <p>
          &ldquo;Copy everything&rdquo; on the Me page puts everything Simpatico keeps on your device (profile, saved words, photo, call card, Recent and your
          private room keys, settings) into your device&rsquo;s clipboard, or into a message you choose to send to yourself. &ldquo;Paste my data&rdquo; on the
          other one reads it back. It never passes through our servers. Anyone you send that code to could use it as you, so only send it to your own devices.
        </p>
        <h3>Calling people again, &ldquo;Active now&rdquo; and &ldquo;Waiting now&rdquo;</h3>
        <p>
          When two people have been in a call together, their devices agree on a private room of their own, so either can call the other again from Recent without
          sending a link. Each device has a random key kept only on that device; the two devices swap keys over the call&rsquo;s own encrypted connection and work
          out the same room code from them. Our server never sees the keys. While the Simpatico home screen is open, your device tells our server, for each of those
          private rooms, that you are available (your first name), and asks who else is available or already waiting in those rooms, and in your call card room.
          This is kept only in memory and forgotten after 45 seconds; only people who share that private room with you can see it.
        </p>
        <h3>&ldquo;Someone&rsquo;s waiting&rdquo; notifications</h3>
        <p>
          If you allow notifications, your device gives our server a push address (a long random web address from Apple, Google or your browser maker) and we store it
          with the call card codes your device follows: your own, and any you have joined, plus your device&rsquo;s random seat ID in each so you aren&rsquo;t notified
          about yourself, and the notification wording in your language. We store no name, photo or call history with it. You are told when someone opens your own call card, or when the
          owner of a call card you have been in opens it; we send that address a short message (&ldquo;Ezgi is waiting for you&rdquo;), encrypted so that only
          your device can read it, through your phone maker&rsquo;s push service. To make sure only real callers can follow a card, our server also keeps the
          random seat IDs that have been in each call card&rsquo;s room (no names). Phones that haven&rsquo;t opened Simpatico for 120 days are forgotten. Turn it off any time on the Me page (&ldquo;Tell me when someone&rsquo;s waiting&rdquo;), which deletes the address from our
          server; it is also deleted automatically if your device stops accepting notifications.
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
        <p>These providers process data on our behalf only to run the service, under agreements that protect it. Data may be processed in other countries, including the United States, the European Union and Australia.</p>
        <ul>
          {providers.map((p) => (
            <li key={p.name}>
              <b>{p.name}</b>: {p.role}
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
