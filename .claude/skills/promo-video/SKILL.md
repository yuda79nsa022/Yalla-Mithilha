---
name: promo-video
description: Make the Bas Bedoon Kalam marketing promo video — a 52-second, 1920×1080 MP4 built from real screenshots of the app (captured with Playwright while playing a full game), with captions in any one or more languages (English and Arabic by default; also e.g. English only, or English and Tamil) celebrating fun and togetherness, the game's music, ending on the game logo and "A GAME BY PERENNIA". Use when the user asks for a promo, trailer, ad, marketing or social video of the game, wants the promo re-made after the app changed, or wants a variant of it (new captions, another length, a vertical 9:16 cut, different music).
---

# Promo video

One command builds the whole thing from the app as it is in this checkout,
so a re-run always shows the current UI:

```bash
.claude/skills/promo-video/scripts/make-promo.sh <outDir>              # full video → <outDir>/promo.mp4
.claude/skills/promo-video/scripts/make-promo.sh <outDir> stills-only  # quick: just the review stills
```

## Languages

The promo isn't tied to English + Arabic. Two settings, both comma-separated:

| Setting | What it is | Default |
|---|---|---|
| `PROMO_LANGS` | Caption languages. The **first** is each scene's big headline, the others are the coloured lines under it. Any language in `stage/captions.js` — today `en`, `ar`, `ta` (Tamil). | `en,ar` |
| `PROMO_SCREENS` | The app's own language in the screenshots. The app exists only in `en` and `ar`. | the `PROMO_LANGS` the app has, else `en` |

```bash
PROMO_LANGS=en    make-promo.sh <outDir>   # English only, English app
PROMO_LANGS=en,ta make-promo.sh <outDir>   # English headlines, Tamil lines, English app
PROMO_LANGS=ar,en make-promo.sh <outDir>   # Arabic-led: layout mirrors, Arabic app in front
PROMO_LANGS=ta,en PROMO_SCREENS=en make-promo.sh <outDir>   # Tamil-led
```

With one screen language each scene shows two different screens instead of
the same screen in EN and AR, and the desktop scene shows one page.

**Adding a language** (e.g. Hindi, French): in `stage/captions.js` add it to
`LANGUAGES` — `dir` (`ltr`/`rtl`), `font` (bundled Archivo / Kufi, or any
Google Fonts family via `google:`, fetched while rendering), `size` relative to
the Latin headline and headline `lineHeight` — and give it every key `en` has
in `CAPTIONS`. The script refuses to run if a key is missing. Render
`stills-only` and check the lines fit. Translated marketing copy (Tamil
included) should be checked by a native speaker before it's published — say
so when delivering.

## Output

Use the session's scratchpad (or another folder outside the repo) as
`<outDir>` — it fills with a web build, a data dir, ~1,500 frames and the
video, none of which belongs in git. Takes ~5 minutes (web export ~1 min, two
full games ~1 min per app language, frames ~1.5 min, encode ~1 min).

## What it makes

Default English + Arabic captions (other languages: `stage/captions.js`):

| Time | Scene | Caption (EN / AR) |
|---|---|---|
| 0:00 | Logo | Game night is better together. / السهرة أحلى… مع بعض |
| 0:05 | Home | Two teams. One screen. Zero words. / فريقين… شاشة وحدة… وولا كلمة |
| 0:10 | Game setup | Name your teams. Pick your decks. / سمّوا فرقكم… واختاروا مجموعاتكم |
| 0:16 | QR hand-off + the actor's phone | Scan the code. Keep the title to yourself. / امسح الرمز… والعنوان سرّ بينك وبين جوالك |
| 0:23 | Timer + scoring | Two minutes. Not a single word. / مثّلها… بس بدون كلام! |
| 0:29 | "Got it!" recap | Every guess, a cheer. / كل جولة… ضحك وحماس |
| 0:34 | Final score | Win together. Laugh together. / نفوز سوا… ونضحك سوا |
| 0:40 | Desktop (EN → AR when both are screen languages) | Arabic & English. Phone, tablet or TV. |
| 0:46 | End card | Game logo · يلّا… جمّعوا ربعكم · A GAME BY **PERENNIA** |

Brand look throughout: the app's own colours (purple `#8038D1`, ink, ground,
green), fonts (Archivo, Noto Kufi Arabic, or the language's own), square corners and hard shadows.

## How it works

- `scripts/make-promo.sh` — the pipeline: `npx expo export -p web`, a
  throwaway server on `:4400` (`PROMO_PORT`) with a fresh `DATA_DIR`, the
  seed decks and a test player (`PROMO_USER`/`PROMO_PASS`, 4 games in the
  wallet); then capture → stage → stills → frames → ffmpeg. It links the web
  build in as `server/public-player` and removes that link (and stops the
  server) on exit, whatever happens.
- `scripts/capture.js <shotsDir> <en|ar>` — plays a whole 20-round game on a
  390×844 phone at 3× (1170×2532 shots): guest home, signed-in home, setup,
  checkout, QR hand-off, the reveal page the QR opens (the actor's phone),
  the timer, scoring, the "Got it!" recap and the final score.
- `scripts/desktop.js <shotsDir> <en,ar>` — the guest home page at 1440×900, per screen language.
- `stage/captions.js` — every line of text, per language, plus each language's font and direction.
  `make-promo.sh` writes `stage/config.js` (`window.PROMO = { langs, screens }`) next to it.
- `stage/promo.html` — the video itself: a 1920×1080 page whose
  `render(t)` positions every element for time `t`. Scenes are the blocks
  under `// N — …`; `textBlock(...)` holds each caption, `phone(...)` each
  screenshot. `TOTAL` is the length in seconds.
- `scripts/render.js <stageDir> <outDir> stills|frames` — stills at
  mid-scene moments for review, or every frame at 30 fps. Frame by frame (not
  screen recording), so nothing stutters or drops.

## Changing it

- **Captions:** edit `stage/captions.js` (every language you'll use needs
  every key). **Scenes:** edit `stage/promo.html`. Run `stills-only` and look at the
  stills before rendering the full video. Text blocks stack from their real
  measured heights, so a longer caption won't overlap the line under it.
- **Length:** change `TOTAL` and the scene start/end times together; the
  encode reads `TOTAL`.
- **Music:** `PROMO_MUSIC=/path/to/track.mp3` (default: the game's own
  `assets/sounds/timer-music.mp3`). It's trimmed, loudness-normalised to
  −16 LUFS, faded in and out under the end card.
- **Company name / end card:** scene 9 in `stage/promo.html` (`PERENNIA`);
  the "A GAME BY" line is `gameBy` in `captions.js`.
  A Perennia logo image would go there too — copy it into `stage/img/` via
  `make-promo.sh` the way `brand-logo.png` is.
- **Vertical 9:16 (Stories/TikTok/Reels):** make a copy of the stage at
  1080×1920 with one phone per scene and the caption above it, and render
  with that viewport — don't just crop the 16:9 frames.

## Always

- **Look before delivering:** read the stills (and a few frames pulled from
  the MP4 with `ffmpeg -ss <t> -frames:v 1`) yourself — overlapping text,
  a screenshot of the wrong screen, or a scene caught mid-transition are
  easy to miss otherwise.
- Hand the MP4 to the user (`SendUserFile`, display `render`), with a short
  scene list and anything they should check (e.g. the music).
- Never point this at the live server: it signs in a test player and spends
  games. It always runs its own throwaway server.

## Pitfalls already hit (and handled in the scripts)

- **Sign-in rate limit:** the server allows 20 player sign-ins per 15
  minutes per address. Each capture signs in once; repeated debugging runs
  against one server will hit it — a fresh run of `make-promo.sh` starts a
  fresh server, which resets it.
- **First run shows the language picker** — the scripts click through it,
  then use the AR/EN toggle.
- **Button text includes arrow glyphs** (`Next round →`), so exact-text
  matching fails; and the screen stack keeps earlier screens mounted. Match
  buttons by accessible name among visible ones:
  `page.getByRole('button', { name }).locator('visible=true').last()`.
- **The QR's reveal token is single-use** — the capture opens it exactly once.
- **Headless Chromium hides scrollbars**; launch with
  `ignoreDefaultArgs: ['--hide-scrollbars']` if a shot should show them.
- **Background cross-fades:** each scene's background fades in over the
  previous one, which stays solid until covered — fading both at once dips
  to the page behind for a moment.
