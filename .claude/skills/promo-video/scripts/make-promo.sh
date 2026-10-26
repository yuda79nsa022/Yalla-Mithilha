#!/usr/bin/env bash
# Builds the Bas Bedoon Kalam promo video end to end from the app as it is in
# this checkout:
#   1. exports the player app for web and serves it from a throwaway server
#      (fresh data dir, the four seed decks, a test player with games in the wallet)
#   2. plays a full game in each app language asked for (PROMO_SCREENS) with
#      Playwright, screenshotting the moments the promo uses, plus the desktop home page
#   3. lays them into stage/promo.html, renders stills to review, then every frame
#   4. encodes an H.264 1080p30 MP4 with the game's own music
#
#   .claude/skills/promo-video/scripts/make-promo.sh <outDir> [stills-only]
#
# Languages (both comma-separated, first one leads):
#   PROMO_LANGS    caption languages — any in stage/captions.js (en, ar, ta …).
#                  The first is each scene's big headline. Default: en,ar
#   PROMO_SCREENS  the app's own language(s) in the screenshots — the app
#                  exists in en and ar only. Default: those of PROMO_LANGS
#                  the app has, else en.
#   e.g. PROMO_LANGS=en               English only
#        PROMO_LANGS=en,ta            English headlines, Tamil lines, English app
#        PROMO_LANGS=ar,en            Arabic-led (layout mirrors), Arabic app in front
#
# `stills-only` stops after step 3's review stills (fast — use it while
# changing captions or scenes). Needs: node + npm deps installed (root and
# server), ffmpeg, and Playwright with Chromium (preinstalled in Claude Code's
# cloud sessions; locally: `npm i -g playwright && npx playwright install chromium`).
set -euo pipefail

OUT="$(mkdir -p "${1:?usage: make-promo.sh <outDir> [stills-only]}" && cd "$1" && pwd)"
MODE="${2:-full}"
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$SKILL/../../.." && pwd)"
PORT="${PROMO_PORT:-4400}"
export BASE="http://localhost:$PORT"
export PROMO_USER="${PROMO_USER:-Dana}"
export PROMO_PASS="${PROMO_PASS:-promoPass123}"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"

APP_LANGS="en ar"   # the languages the app itself is in
LANGS="${PROMO_LANGS:-en,ar}"
if [[ -z "${PROMO_SCREENS:-}" ]]; then
  PROMO_SCREENS=""
  for l in ${LANGS//,/ }; do [[ " $APP_LANGS " == *" $l "* ]] && PROMO_SCREENS+="${PROMO_SCREENS:+,}$l"; done
  PROMO_SCREENS="${PROMO_SCREENS:-en}"
fi
SCREENS="$PROMO_SCREENS"
# Every caption language needs its lines in captions.js, every screen language must be one the app has.
node -e "
  global.window = {}; require('$SKILL/stage/captions.js');
  const keys = Object.keys(window.CAPTIONS.en);
  for (const l of '$LANGS'.split(',')) {
    if (!window.LANGUAGES[l] || !window.CAPTIONS[l]) { console.error('No captions for \"' + l + '\" — add it to stage/captions.js (LANGUAGES and CAPTIONS).'); process.exit(1); }
    const missing = keys.filter((k) => !(k in window.CAPTIONS[l]));
    if (missing.length) { console.error('captions.js: \"' + l + '\" is missing ' + missing.join(', ')); process.exit(1); }
  }
  for (const l of '$SCREENS'.split(',')) if (!'$APP_LANGS'.split(' ').includes(l)) { console.error('PROMO_SCREENS: the app has no \"' + l + '\" — use en and/or ar.'); process.exit(1); }
"
echo "Captions: $LANGS · app screens: $SCREENS"

SERVER_PID=""
cleanup() {
  # The server runs in its own process group (setsid below): npx → tsx → node is
  # three processes, and stopping only the first would leave the server running.
  [[ -n "$SERVER_PID" ]] && kill -- "-$SERVER_PID" 2>/dev/null || true
  # Only remove the player-app link this script made — never a real deployment's folder.
  [[ -L "$ROOT/server/public-player" ]] && rm -f "$ROOT/server/public-player"
}
trap cleanup EXIT

step() { printf '\n\033[1;35m▶ %s\033[0m\n' "$1"; }

if [[ -e "$ROOT/server/public-player" && ! -L "$ROOT/server/public-player" ]]; then
  echo "server/public-player is a real folder here — refusing to replace it. Move it aside first." >&2
  exit 1
fi

step "Exporting the player app for web"
rm -rf "$OUT/web"
(cd "$ROOT" && npx expo export -p web --output-dir "$OUT/web" > "$OUT/export.log" 2>&1)
ln -sfn "$OUT/web" "$ROOT/server/public-player"

step "Starting a throwaway server on :$PORT (fresh data, seed decks, test player)"
export DATA_DIR="$OUT/data" SESSION_SECRET="promo-$RANDOM-$RANDOM" PLAYER_SESSION_SECRET="promo-player-$RANDOM-$RANDOM"
rm -rf "$DATA_DIR"
(cd "$ROOT/server" && npx tsx src/seedDecks.ts > "$OUT/seed.log" 2>&1)
(cd "$ROOT/server" && npx tsx src/createTestPlayer.ts --username="$PROMO_USER" --password="$PROMO_PASS" --credits=4 | tail -1)
(cd "$ROOT/server" && PORT="$PORT" exec setsid npx tsx src/index.ts > "$OUT/server.log" 2>&1) &
SERVER_PID=$!
for _ in $(seq 1 30); do curl -sf "$BASE/health" > /dev/null && break; sleep 1; done
curl -sf "$BASE/health" > /dev/null || { echo "server did not start — see $OUT/server.log" >&2; exit 1; }

step "Playing a full game in each app language ($SCREENS), screenshotting it"
mkdir -p "$OUT/shots"
for l in ${SCREENS//,/ }; do node "$SKILL/scripts/capture.js" "$OUT/shots" "$l"; done
node "$SKILL/scripts/desktop.js" "$OUT/shots" "$SCREENS"

step "Assembling the stage (template, fonts, screenshots, logo)"
rm -rf "$OUT/stage"
mkdir -p "$OUT/stage/fonts" "$OUT/stage/img"
cp "$SKILL/stage/promo.html" "$SKILL/stage/captions.js" "$OUT/stage/"
node -e "
  const q = (s) => JSON.stringify(s.split(','));
  require('fs').writeFileSync('$OUT/stage/config.js', 'window.PROMO = { langs: ' + q('$LANGS') + ', screens: ' + q('$SCREENS') + ' };\n');
"
F="$ROOT/node_modules/@expo-google-fonts"
cp "$F/archivo/800ExtraBold/Archivo_800ExtraBold.ttf" "$F/archivo/900Black/Archivo_900Black.ttf" \
   "$F/noto-kufi-arabic/500Medium/NotoKufiArabic_500Medium.ttf" "$F/noto-kufi-arabic/700Bold/NotoKufiArabic_700Bold.ttf" \
   "$F/noto-kufi-arabic/900Black/NotoKufiArabic_900Black.ttf" "$OUT/stage/fonts/"
cp "$OUT"/shots/*.png "$OUT/stage/img/"
cp "$ROOT/assets/images/brand-logo.png" "$OUT/stage/img/"

step "Rendering review stills"
node "$SKILL/scripts/render.js" "$OUT/stage" "$OUT" stills
if [[ "$MODE" == "stills-only" ]]; then
  echo "Stills in $OUT/still-*.png — review them, then run again without stills-only."
  exit 0
fi

step "Rendering every frame"
rm -rf "$OUT/frames"
node "$SKILL/scripts/render.js" "$OUT/stage" "$OUT" frames

step "Encoding the MP4 (H.264 1080p30, AAC, the game's own music)"
DURATION=$(node -e "const s=require('fs').readFileSync('$OUT/stage/promo.html','utf8');console.log((s.match(/const TOTAL = (\d+)/)||[])[1]||52)")
MUSIC="${PROMO_MUSIC:-$ROOT/assets/sounds/timer-music.mp3}"
FADE_OUT=$(node -e "console.log(Math.max(0, $DURATION - 3.5))")
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$OUT/frames/%05d.jpg" -i "$MUSIC" \
  -filter_complex "[1:a]atrim=0:$DURATION,asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.8,afade=t=out:st=$FADE_OUT:d=3.5[a]" \
  -map 0:v -map "[a]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -r 30 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest "$OUT/promo.mp4"

ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT/promo.mp4"
echo "Done: $OUT/promo.mp4"
