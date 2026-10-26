#!/usr/bin/env bash
# Starts Bas Bedoon Kalam for the promo (run by the promo-video skill, from
# the repo root): exports the player app for web, links it in as
# server/public-player, and runs a throwaway server on $PROMO_PORT with a fresh
# data dir in $PROMO_WORK, the seed decks and a test player with games in the
# wallet. Never point the promo at the live server — it spends games.
set -euo pipefail

if [[ -e server/public-player && ! -L server/public-player ]]; then
  echo "server/public-player is a real folder here — refusing to replace it. Move it aside first." >&2
  exit 1
fi
npx expo export -p web --output-dir "$PROMO_WORK/web" > "$PROMO_WORK/export.log" 2>&1
ln -sfn "$PROMO_WORK/web" server/public-player

export DATA_DIR="$PROMO_WORK/data" SESSION_SECRET="promo-$RANDOM-$RANDOM" PLAYER_SESSION_SECRET="promo-player-$RANDOM-$RANDOM"
cd server
npx tsx src/seedDecks.ts > "$PROMO_WORK/seed.log" 2>&1
npx tsx src/createTestPlayer.ts --username="${PROMO_USER:-Dana}" --password="${PROMO_PASS:-promoPass123}" --credits=4 | tail -1
PORT="$PROMO_PORT" exec npx tsx src/index.ts
