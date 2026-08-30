# Yalla Mithilha — يلا مثّلها

A party game for Kuwaiti and Gulf gatherings. One phone, a room full of people,
and seven mini-games that reward performance rather than knowledge.

> You do not need to know the answer. You need your friends to understand you.

## Running it

```bash
npm install
npx expo start          # then press i for iOS or a for Android
```

Requires Node 18 or newer and the Expo Go app (or a development build) on the
device. The game works fully offline once installed — no account, no network
call, no permissions requested.

```bash
npm test                # 94 unit and interaction tests
npm run typecheck       # whole project, screens included
npm run typecheck:core  # engine, content and i18n only (no React Native needed)
```

## What is in the box

| Area | Where | Notes |
| --- | --- | --- |
| Game engine | `src/engine/` | Pure TypeScript, no React Native imports |
| Content | `src/content/` | 146 bilingual cards + an authoring validator |
| Localisation | `src/i18n/` | Arabic and English catalogues, key-parity tested |
| App state | `src/state/` | Provider plus a pure round controller |
| Screens | `app/` | Expo Router file routes |
| Design system | `src/ui/` | Tokens and reusable components |
| Platform seams | `src/platform/` | Storage, haptics, RTL, tilt, audio |
| Services | `src/services/` | Analytics contract, entitlements |

## Architecture

The engine is deliberately framework-free. Everything about *how the game
works* — which mini-game comes next, who performs, which cards are dealt, what
a card is worth — lives in `src/engine` and `src/state/roundController.ts` and
is tested in plain Node. The screens are a thin layer that renders state and
calls those functions.

Two consequences worth knowing:

**One config table drives the session.** `src/engine/config.ts` holds a row per
mini-game with its clock, card count, skip limit, eligible rooms and levels,
scheduling weight, and whether it needs a pass-the-phone screen. Adding an
eighth mini-game means adding a row and a renderer. The scheduler, the dealer
and the scoring do not change.

**Free-for-all is two teams' worth of code, not two code paths.** In FFA every
player becomes a one-person team, so turn order, scoring, the final challenge
and the winner screen all work unchanged.

### The session lifecycle

```
createSession()   reserves every round's cards up front, so the deck can be
                  checked for repeats before the first card is shown
   ↓
pass → brief → round → result      (repeats)
   ↓
advance()         moves the cursor, appends sudden death on a tie
   ↓
finished → winner → rematch
```

### Repetition prevention

Three layers, in order:

1. A prompt never repeats inside one session.
2. A rolling window of the last 40 prompt ids **per mini-game** carries across
   sessions and is avoided.
3. If a narrow room and level leave too few cards, the oldest memories are
   released first, and only then are session cards recycled — never one from
   the previous two rounds.

That last fallback is why a long game in the Kids room deals full rounds
instead of half-empty ones.

## Content levels

Levels are ordered: `kids < family < friends < adults`. A card declares the
*lowest* audience it suits, and a session shows everything at or below the
selected level. A kids card is fine in an adults game; the reverse never
happens. `npm test` asserts this.

## Privacy

- Player names, scores and settings are stored on the device only.
- No network calls anywhere in the app.
- No camera, microphone, contacts, or location permission is declared.
- The analytics module is typed so player names and prompt text *cannot* be put
  in an event, and it is wired to a no-op sink.
- Settings has a one-tap wipe of everything stored locally.

## Documentation

- `docs/CONTENT_GUIDE.md` — how to write and add cards
- `docs/ASSUMPTIONS.md` — decisions made where the brief left room
- `docs/PRODUCTION_CHECKLIST.md` — what still stands between this and the store

## Licensing note

Every card was written for this game. No question bank, card text, visual
identity or mechanic was copied from another product.
