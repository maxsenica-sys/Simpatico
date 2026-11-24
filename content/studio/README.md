# Content studio

Draws every illustrated post in `content/queue.csv`: the cast, the phone screens, the slides and the reels.
Nothing here is drawn by hand, so a change to a costume, a colour or a template re-renders every post the same way.

| File | What it is |
|---|---|
| `cast.mjs` | The eight characters: one skeleton, eight costumes. A pose is a set of joint angles. |
| `poses.mjs` | Every pose name the queue uses (see `content/RULES.md`). |
| `dialogue.mjs` | What the phone shows per language. A native speaker should check a language before its posts go out. |
| `screens.mjs` | The seven phone screens (`ui_card`), drawn large in the app's own look. |
| `slides.mjs` | The slide templates, at 1080 x 1350 (Instagram) and 1080 x 1920 (TikTok, Reels). |
| `render.mjs` | Renders carousels and stills. |
| `reel.mjs` | Renders reels as video, frame by frame. |
| `gallery.mjs` | Builds `content/out/index.html`, every post in posting order with captions to copy. |

## Render

```bash
(cd content/studio/fonts && npm install)
```

```bash
node content/studio/render.mjs
```

```bash
node content/studio/reel.mjs
```

```bash
node content/studio/gallery.mjs
```

Add post ids to render only those (`node content/studio/render.mjs S001 S043`). Output goes to `content/out/`
(not kept in git): one folder per post with the Instagram and TikTok files, `instagram.txt`, `tiktok.txt`
and, for reels, `voiceover.txt` with the script and the time each line is on screen.

Needs Node, Playwright with Chromium, and ffmpeg for the reels.

## The look

- Colours: dark `#0b0d10`, off-white `#f4f5f7`, blue `#5b8cff`, mint `#5fe0bd`. Type: Nunito.
- Beat by beat: hook (blue or dark), right now (off-white), what it costs (dark, character in a spotlight),
  with Simpatico (mint, the phone), what changes (off-white), ask (dark, logo).
- TikTok and Reels frames keep text clear of the buttons down the right and the caption at the bottom,
  which is why the bottom of those frames is empty.
