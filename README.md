# Yalla Mithilha — يلا مثّلها

Charades on real titles. Two teams, one phone (or a TV and everyone's own
phone), twenty rounds of silent acting on real Kuwaiti, Khaleeji and
Egyptian movies, series and plays.

> You do not need to know the answer. You need your friends to understand you.

## Running it

Charades needs a backend for accounts, the wallet and the deck catalogue —
see `server/README.md` for that half. Once it's running:

```bash
npm install
export EXPO_PUBLIC_CATALOGUE_API_URL=http://localhost:4000   # or wherever the server is
npx expo start          # then press i for iOS, a for Android, or w for web
```

Requires Node 18 or newer and the Expo Go app (or a development build) on
the device.

```bash
npm test                # unit and interaction tests
npm run typecheck       # whole project, screens included
npm run typecheck:core  # engine, i18n and services only (no React Native needed)
```

## What is in the box

| Area | Where | Notes |
| --- | --- | --- |
| Charades engine | `src/engine/charades.ts` | Pure TypeScript, no React Native imports — drafting, turn alternation, scoring, completion |
| QR reveal | `src/engine/reveal.ts` | Builds the link a shared screen's QR code encodes; the reveal page itself is `app/charades/reveal.tsx` |
| Localisation | `src/i18n/` | Arabic and English catalogues, key-parity tested |
| App state | `src/state/AppProvider.tsx` | Preferences, the Charades session, the wallet, the player account |
| Screens | `app/` | Expo Router file routes |
| Design system | `src/ui/` | Tokens and reusable components |
| Platform seams | `src/platform/` | Storage, RTL, keep-awake |
| Services | `src/services/` | Wallet/player HTTP clients, the analytics contract |

## Architecture

The engine is deliberately framework-free: everything about *how a round
works* — team alternation, scoring, when a session ends — lives in
`src/engine/charades.ts`, tested in plain Node. The screens are a thin
layer that renders state and calls those functions.

**The reveal never touches the shared screen.** Whatever device is showing
`app/charades/play.tsx` (a TV, a laptop, a phone passed around) only ever
renders a QR code — never the round's title. The actor scans it with their
own phone's stock camera, which opens `app/charades/reveal.tsx` as a normal
web link. See `server/README.md`'s "App integration" section for exactly
how the link's address is resolved.

**The web build's entry point is a landing page, not the app menu.**
`app/index.tsx`'s splash redirects to `/landing` (`app/landing.tsx`) only
when `Platform.OS === 'web'` — a website visitor may not know what the game
even is yet, unlike someone who just installed it. Native installs skip
straight to `/home`, which is Charades' own hub: account/wallet status, the
deck list, and "Start a new game" or "Resume."

### The session lifecycle

```
draftCharades()    picks a deck and names two teams
   ↓
checkout           sign in if needed, top up the wallet, spend one credit
   ↓
unlockCharades()   server deals 20 titles from the deck
   ↓
award/skip         (repeats, alternating teams, scores accumulate)
   ↓
complete           winner declared (or a tie)
```

## Privacy

- Team names and preferences are stored on the device only.
- Playing needs an account and a connection — there is no offline
  fallback, since it involves a real wallet. Signing up or signing in sends
  a username and password to the server; topping up and playing move money
  through your account's wallet, held on the server, never on the device.
- The QR-code reveal opens in the phone's own browser as a normal web
  link — nothing inside this app ever requests a camera permission.
- No microphone, contacts, or location permission is declared either.
- The analytics module is typed so a player name cannot be put in an event,
  and it is wired to a no-op sink.
- Settings has a one-tap wipe of everything stored locally, including the
  saved account session.

## Documentation

- `docs/GAP_ANALYSIS.md` — honest area-by-area status, including the full security review
- `server/README.md` — the backend: accounts, the wallet, decks, the admin CMS

## Licensing note

The Charades engine, screens and UI were written for this game. Deck
content (movie, series and play titles) is real, publicly known work
titles, imported by an admin — see `server/README.md`'s "Decks and titles"
section for how.
