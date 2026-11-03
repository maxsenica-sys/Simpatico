# Talk

One-to-one browser video calls. Both people hear each other's real voice, untouched, and each reads the other in their own language as live captions on the video.

- No account, no install. The guest taps one link.
- Language is per person. It is detected from the device on first visit, stored in `localStorage`, and never asked again. There is no room-level language pair.
- Captions come in two passes. Soniox streams a literal translation within a few hundred ms (shown at 60% opacity). When the utterance ends, an LLM rewrites the source sentence idiomatically and swaps it in at 100%.

## Architecture

```
Browser A (speaks en, reads en)        Fly app (server.ts)            Browser B (speaks tr, reads tr)
  |-- own mic, PCM16 16 kHz (ws) ---->  | -> Soniox WS (src en -> tgt tr)
  |                                     | <- literal tokens
  |                                     | --- caption "live" (60%) ---------> |
  |                                     | -> Claude Haiku on utterance end
  |                                     | --- caption "refined" (100%) -----> |
  |  <------------------ same pipeline in reverse, tr -> en ----------------- |
  |<=============== WebRTC audio + video, peer to peer, untouched ==========>|
```

A single Node process serves Next.js and a `ws` server on `/ws`. Each browser has one socket, which carries signalling, its own mic audio (binary frames, sent only while it detects voice), and the captions of the other person.

| Path | What it does |
|---|---|
| `server.ts` | HTTP + Next handler, `/api/rooms`, `/healthz`, WebSocket routing |
| `server/rooms.ts` | In-memory rooms. Seats with a 15 s reconnect grace. Expiry 2 h after creation, or 60 s after both sockets are gone |
| `server/pipeline.ts` | Per-speaker caption pipeline: token assembly, utterance boundaries, pass 2, anti-flicker rules, Soniox restart and idle close |
| `server/soniox.ts` | One upstream Soniox real-time session (keepalive, finalize, buffering while connecting) |
| `server/refine.ts` | Pass 2 prompt and call (`claude-haiku-5-5`, thinking off, 1500 ms deadline) |
| `server/ice.ts` | Public STUN. Adds Cloudflare Realtime TURN if `CF_TURN_*` is set |
| `lib/call.ts` | Client call controller: signalling, `RTCPeerConnection`, ICE restart, connect timeout, caption state |
| `lib/audio.ts`, `public/pcm-worklet.js` | AudioWorklet tap on the same mic track that is in the peer connection. Downsamples to 16 kHz PCM16 in 100 ms chunks, with a voice-activity gate |
| `shared/lang.ts`, `shared/languages.ts` | `ParticipantLang` and the generated list of supported languages |
| `i18n/*.json` | UI strings. `en` is the source; `tr` is hand-written; `ar bn es fr hi id pt ru ur zh` are machine-translated by `scripts/translate-ui.ts`. Any other language falls back to English |

### How languages are wired

Each client sends `{ speaks, reads, ui }` when it joins. The server configures A's Soniox stream as `source = A.speaks, target = B.reads`, and B's the other way round. A stream only exists while both people are connected. When two people share a language, the stream transcribes without translating.

### Pass 2 and anti-flicker

- The LLM gets the **source-language** text, the last 6 utterances from both sides, and the room glossary.
- The hard deadline is 2000 ms from the end of the utterance (the brief said 1500; real calls showed Claude Haiku at 0.75–1.5 s, which dropped about 40% of rewrites). A late result is discarded, and the literal caption settles instead.
- A refinement is ignored if it differs from the literal by only case, punctuation or a couple of characters (`server/text.ts`).
- Once a line is settled, the client never changes it. A line that has scrolled out of the 3-line window is frozen.

### Group calls

**Start a group call** creates a room for up to 12 people (`GROUP_MAX`). Each person sets their own name and language, and everyone else's speech reaches them in that language.

- **Translation fan-out.** Each speaker gets one Soniox stream per language that someone else in the call reads (`server/rooms.ts` → `updatePipelines`). People who read the speaker's own language get the original words. Streams exist only while someone reads that language, and close after 10 s of silence. Silent listeners cost nothing.
- **Transport.** Group calls are a full mesh: every phone connects directly to every other phone. Above 3 other people, only whoever spoke last sends video, to save bandwidth, and the screen switches to them. Beyond about 12 people this needs an SFU (Cloudflare Realtime); the rest of the app stays the same.
- **In the room.** For people sitting together, such as a team meeting. Phones of in-room people don't play each other's audio, which would cause echo, and only the phone that hears the speaker loudest is captioned (`admitAudio` floor control). This avoids duplicate captions from every phone in the room. Each audio frame carries its level in byte 0 for this.
- Captions and the transcript show the speaker's name. A strip shows everyone with a speaking ring, their language, and a mini video in small groups.

### Long sentences

Soniox translates a phrase at a time, at commas and pauses. When someone talks for a while without a break, the reader would otherwise wait for the phrase to end. So when 4 or more words have gone untranslated for 0.8 s, the server sends just that stretch to Claude for a quick interim translation, shown faded like other live text. At most one request runs at a time, about every 1.2 s.

Soniox's own translation replaces the interim as soon as it arrives, and the full-sentence rewrite replaces that. On a 31-second recording, interim translations cut the wait for the first caption from 2.4 s to 1.8 s after the first recognised words. They also raised the number of caption updates while speaking from 11 to 19, typically arriving 0.9 s after each request. Soniox endpoints are also set to arrive a little sooner (`endpoint_latency_adjustment_level: 1`).

### Echo

The browser's echo cancellation is on. In addition, the client sends audio only while local voice is above an adaptive threshold (noise floor + 12 dB). The threshold rises by 10 dB while the other person is audibly talking, so their voice leaking from a speakerphone is less likely to be transcribed as yours.

### Video, audio only and call health

- **Join with video** or **Join audio only**. During the call, anyone can turn the camera off and on, flip between front and back cameras, or switch to audio only and back. Audio only stops video in both directions and saves the most data. Captions and the transcript keep working in every mode.
- The video slot is always negotiated (`sendrecv`, even with the camera off), so every camera change is a `replaceTrack` with no renegotiation.
- **Health check.** Every 2 s each side measures what is actually arriving (`getStats`) and tells the other side (`status` signal). The phone sending the video acts on it:
  - its camera track is dead or not sending frames → it restarts the camera itself;
  - the other side reports no video or audio for 6 s → it restarts the camera or mic; if that doesn't help, it restarts the connection (ICE restart);
  - this happens automatically, and a banner explains it ("They can't see your video…"), with a manual **Restart video** button.

  This fixes a real bug: iOS stops the camera while Safari is in the background (for example, the host switching to WhatsApp to send the link), and the host's video never came back.
- **Weak connection.** Packet loss above 8%, a round trip over 700 ms, or upload below 200 kbit/s first lowers the video quality without asking. If the connection stays weak, a banner offers **Switch to audio only**. Audio is sent at high priority, so the browser drops video quality before voice.
- **Captions check.** The top-left badge shows whether captions are working in both directions (green, amber or red). Your own recognised words appear briefly at the top, so you can see what the other person is reading. Three dots show when the other person is speaking before their words arrive.
- Host and guest get exactly the same controls: Mic, Camera, Flip, Audio only, Text and End.

## Running locally

```bash
npm install
```

```bash
cp .env.example .env   # then fill in SONIOX_API_KEY and ANTHROPIC_API_KEY
```

```bash
set -a; source .env; set +a; npm run dev
```

The app runs on http://localhost:3000. For a phone on the same network you need HTTPS, because `getUserMedia` requires a secure context. Use a tunnel (for example `cloudflared tunnel --url http://localhost:3000`) or deploy.

Without `SONIOX_API_KEY` the call still works, and the reader sees "captions unavailable". Without `ANTHROPIC_API_KEY`, captions stay on Soniox's literal translation.

## Privacy

`/privacy` describes exactly what the app does with data. Fill in the operator's name and contact email in `shared/brand.ts` before charging money, and have a lawyer review the policy. The join screen links to it with a one-line consent notice.

## Tests

```bash
npm test
```

Server pipeline tests run against an in-process fake Soniox. They cover live → final, translation-tail attribution, drop → paused → transparent reconnect, closing upstream immediately on leave, the same-language pair, and the edit-distance rule.

```bash
npm run mock-soniox
```

```bash
SONIOX_API_KEY=x SONIOX_URL=ws://localhost:3999 ANTHROPIC_API_KEY=x ANTHROPIC_BASE_URL=http://localhost:3998 npm run dev
```

```bash
npm run e2e
```

The end-to-end test uses two real Chromium instances, one `en-AU` desktop and one `tr-TR` phone, with a fake camera and synthetic speech. It checks:
- the Turkish join screen with no settings touched
- WebRTC both ways
- pass-1 captions at 60% opacity, then refined captions
- the transcript sheet and the captions-working check
- the same controls for host and guest
- camera off and on
- a camera that dies mid-call and recovers on its own
- audio only and back
- hang-up

`npm run e2e:group` (with the mock server running) tests the team-meeting case with four browsers:
- **Coach:** Turkish, remote.
- **Max:** English, remote.
- **Ivan:** Russian, in the room, audio only.
- **Ayşe:** Turkish, in the room, audio only.

It checks:
- every caption arrives in each reader's language and carries the speaker's name;
- in-room phones don't play each other;
- someone leaving doesn't end the call.

`npm test` also runs the room tests (per-language pipelines, in-room floor control). The mock LLM is deliberately late on every 4th call to exercise the deadline. Screenshots are written to `test/out/`.

## Deploying to Fly

Rooms live in memory, so run exactly one machine.

```bash
fly launch --no-deploy --copy-config
```

```bash
fly secrets set SONIOX_API_KEY=... ANTHROPIC_API_KEY=...
```

```bash
fly deploy --ha=false
```

Check whether calls go direct or through a relay:

```bash
fly logs | grep client_ice_connected
```

If a call ever fails to connect (`client_connect_timeout` / `client_ice_failed` in the logs), set `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN` from Cloudflare Realtime TURN. Nothing else changes.

## Adding languages and UI translations

```bash
SONIOX_API_KEY=... npm run sync-languages
```

```bash
ANTHROPIC_API_KEY=... npm run translate-ui
```

The first command regenerates `shared/languages.ts` from Soniox's model list. The second machine-translates `i18n/en.json` into every supported language that doesn't have a bundle yet. Bundles listed as reviewed (`en`, `tr`) are never overwritten. Check the generated files in.

## Departures from the brief

- **`reads` is exchanged through the signalling server, not a WebRTC data channel.** The server configures Soniox, so it needs both values before media flows. A data channel would add a round trip and a second source of truth.
- **The join screen asks for camera and mic as soon as it loads,** so the guest sees their own preview straight away and joins with one tap.
- **The audio-only fallback:** if there is no camera, the call continues with audio and captions.
- **Upstream Soniox sockets also close after 10 s without speech** and reopen on the next speech, with a 300 ms pre-roll buffered. Soniox bills for the time a stream is open.

## Not yet verified

- Not yet tested with a real Soniox key, a real Claude call, or on a real iPhone. Everything above was run against mocks and headless Chromium.
- The Soniox token handling follows their docs. Their docs do not say exactly where translation tokens fall relative to `<end>`, so trailing translation tokens are attributed to the closed utterance using a quiet-period heuristic (`SEAL_QUIET_MS`). Check this against real traffic.
- The voice-activity thresholds in `lib/audio.ts` are starting values. Tune them on a real phone on speaker.
- The `tr` UI strings are mine, and the other ten are machine-translated. A native speaker should review any language you rely on, then add it to `REVIEWED` in `scripts/translate-ui.ts` so it is never regenerated.
