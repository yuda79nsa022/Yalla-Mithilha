# Charades admin server

A small, separate Node/Express/TypeScript backend for Yalla Mithilha's
Charades game. Manages decks (named pools of titles to act out), the
admin-set price of one game, admin accounts, and player accounts and their
wallets. Not part of the Expo app's dependency graph; nothing here is
bundled into the mobile/web build.

## The one rule that matters

**A deck is playable the moment it has at least one title** — there is no
separate publish step and no fixed size to fill. `listPlayableDecks()`
(`src/db.ts`) is the single gate `allTitlesPool()` filters through before a
session deals from it. Unlike the old board-game category (which needed six
complete tiles *and* an explicit publish), a deck an admin just created and
imported into is immediately live.

## Running it

```bash
npm install
export SESSION_SECRET=some-long-random-string
export PLAYER_SESSION_SECRET=a-different-long-random-string
npm run create-admin -- --username=you --password=at-least-8-chars   # first account
npm run dev   # starts on :4000 by default
```

Open `http://localhost:4000/` for the admin UI and sign in with that
account. Once signed in, an admin can add more admin accounts from the
"Admins" tab — the CLI bootstrap is only needed for the very first one,
since there's no API route for "create an admin" without already being
logged in as one.

From the "Decks" tab: create a deck, upload a `.docx`/`.xlsx`/`.pdf` list of
titles (every non-duplicate line gets added — no size limit), and set the
price of one game (shown/entered in KD, stored as fils; 1000 fils = 1 KD).

### Starter decks

```bash
npm run seed-decks
```

Loads four real decks bundled in `seed-data/decks/*.json` — Kuwaiti Plays,
Egyptian Plays, Egyptian TV Series, and Gulf Series, ~500 titles each —
straight into the database. Safe to re-run: an existing deck is left alone,
and `addTitlesToDeck` itself skips any title already present, so re-running
only tops up whatever's missing rather than duplicating anything.

### Test player

```bash
npm run create-test-player -- --username=tester --password=testPass123 --credits=3
```

Creates a player account that already has a wallet balance (default 3
games, override with `--credits`), so testing "a player who already has
games left" doesn't mean topping up by hand through checkout first. A real
player only ever gets credits by paying — `grantCredits` in `src/db.ts`
grants them with no payment behind them, and only this script ever calls
it. Safe to re-run with the same username: it tops up the existing
account's balance instead of failing on the duplicate username.

## Environment variables

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4000` | |
| `SESSION_SECRET` | — | Signs admin login sessions (JWT). Required for any `/admin/*` route — the server 500s on those routes if unset, rather than silently running unauthenticated. |
| `PLAYER_SESSION_SECRET` | — | Signs player-account session tokens (JWT), entirely separate from `SESSION_SECRET` — a player token can never verify as an admin session or vice versa. Required for `/players/*`, `/charades/*` and any player-only route. |
| `DATA_DIR` | `./data` | Where the SQLite file lives. |
| `DB_PATH` | `<DATA_DIR>/catalogue.sqlite` | Override the exact file — tests set this to an isolated temp path. |

`.env` in this directory is loaded automatically (`src/loadEnv.ts`, the
first import of every entry point) — copy `.env.example` to `.env` and fill
it in rather than exporting these by hand every time.

## Auth model

Real admin accounts (username + bcrypt-hashed password), not a single shared
secret — `src/auth.ts` + the `admin_users` table. `POST /admin/auth/login`
exchanges credentials for a 12-hour JWT; every other `/admin/*` route
requires it as a bearer token. Any signed-in admin can list, add, rename,
change the password of, or delete any other admin (`/admin/users`) — flat,
no roles, appropriate for a small trusted content team. The one guard rail:
deleting the last remaining admin account is refused, so nobody can lock
everyone out of the dashboard by mistake.

Player accounts are a separate system for people actually playing — not
the CMS, and not optional once real money is involved. `src/auth.ts` + the
`players` table, signed with their own `PLAYER_SESSION_SECRET`.
`POST /players/register` and `POST /players/login` are public and exchange
a username/password for a 12-hour JWT — there is no way to hold a wallet
balance without an account. Admins can list,
rename, reset the password of, and delete any player account
(`/admin/players`); unlike admin accounts, there's no "last remaining
account" guard, since deleting every player carries no lockout risk.

## The wallet

A Charades credit is owned by a player's account, never by a device —
`payments` and an append-only `credit_transactions` ledger in `src/db.ts`.
A balance is always the sum of grants minus the sum of consumes, never a
mutable counter, so it can't drift from its own history. There is exactly
one product: one game, priced at whatever `settings.game_price_fils` is set
to *at the moment checkout starts* — the price an admin sets later never
changes what an already-initiated payment charges.

Checkout logic (`src/routes/charades.ts`) is written against a
`PaymentProvider` interface (`src/payments/provider.ts`), not a specific
gateway's SDK. Right now that interface is implemented by
`MockPaymentProvider` — there is no real KNET/aggregator integration yet, by
design, until real merchant credentials exist. Swapping in a real
`KnetPaymentProvider` later is meant to be an isolated change: the provider
would additionally need to return a real redirect URL from `createCheckout`,
and a real payment confirmation would come from a signature-verified webhook
route rather than the player's own authenticated `confirm` call (see the
comment on `PaymentProvider` for exactly what that requires).

Both the "duplicate webhook" and "resume an interrupted session" cases are
handled explicitly, not just by convention:

- `confirmPayment` grants a credit via a conditional
  `UPDATE ... WHERE status='initiated'` — it can only ever succeed once per
  payment, so calling confirm twice (a retried callback) never double-grants.
- `startGameSession` is idempotent on `game_sessions.id`, which is the
  *client's own* locally-generated session id (made once when the player
  taps "Start the game"). Replaying the same id after an app restart
  returns the same 20 already-dealt titles and spends nothing further.

## Decks and titles

A deck (`decks` table) is just an id and a bilingual name. Its titles
(`titles` table) are a flat, unlimited-size list — no fixed slot count like
the old board-game category's six tiles, and no separate written
prompt/answer pair per title: charades is silent acting, so the title
itself is both what the actor privately reads and what confirms the guess
once revealed. `POST /admin/decks/:id/import` (multipart, field `file`)
parses a `.docx`/`.xlsx`/`.pdf` and appends every non-duplicate,
non-empty title directly — no staged preview step, since there's no fixed
slot count an import could accidentally overrun or need to protect.
`src/import/parseTitles.ts` has the exact table-parsing heuristic (the
title is the one cell per row that's neither numeric nor a highly-repeated
label like a year or category column).

The player never picks a deck. `startGameSession` deals 20 titles
(`TITLES_PER_SESSION` in `src/db.ts`) at random from every playable deck
*combined* (`dealTitles()`), without replacement within that session — so
the category and the title are both a surprise, and the same title text
can never appear twice in one session even if it exists in two different
decks (deduplicated by trimmed text before dealing). Dealing is also
round-robin across decks, so two consecutive rounds never share a category
unless only one deck has titles left. Fewer than 20 titles across every
deck combined? Deals all of it. Each dealt title carries its own deck's id
and bilingual name (`DealtTitle` in `src/types.ts`) so the
app can show which category it came from once revealed.

## Audit log

Every sensitive admin action — deck create/update/delete, title import/
remove, the game price changing, admin and player account
create/rename/delete — is recorded in an append-only `audit_log` table
(`recordAudit` in `src/db.ts`): who (actor id and a *snapshotted* username,
so a later rename or deletion never rewrites history), what action, what
target, and a before/after JSON snapshot where one is meaningful. It is
deliberately read-only from the API and the admin UI's "Audit log" tab —
there is no edit or delete route for it, on purpose. A password is never
written to it, only whether one changed (`passwordChanged: true/false`);
this is asserted by a test, not just a convention. Logging itself can
never fail the action it's logging — `recordAudit` catches and logs its
own errors rather than throwing.

## API shape

- `GET /charades/price` — public. `{ fils, currency }`, the current price of
  one game.
- `POST /admin/auth/login` — public. `{ username, password }` →
  `{ token, user }`.
- `GET/POST/PUT/DELETE /admin/users[/:id]` — bearer-token protected. Manage
  admin accounts. Never returns a password hash.
- `POST /players/register` / `POST /players/login` — public, CORS-open (same
  reasoning as `/charades/price` — called cross-origin from the app running
  as a web page; a JSON POST also triggers a CORS preflight, so `OPTIONS`
  gets an explicit response too). `{ username, password }` →
  `{ token, player }`. Never returns a password hash.
- `GET/PUT/DELETE /admin/players[/:id]` — bearer-token protected (admin
  session, not a player session). List, rename, reset the password of, or
  delete a player account. No route to create one here — accounts are
  created by the player themselves via `/players/register`.
- `GET/POST/PUT/DELETE /admin/decks[/:id]` — bearer-token protected. A new
  deck starts with zero titles.
- `POST /admin/decks/:id/import` — multipart upload, field name `file`,
  `.docx`/`.xlsx`/`.pdf`. Adds every non-duplicate title straight to the
  deck; `{ titlesFound, added, skipped, deck }`.
- `DELETE /admin/decks/:deckId/titles/:titleId` — removes one title.
- `GET/PUT /admin/settings/game-price` — bearer-token protected.
  `{ fils }`, a positive integer, at most 100000 (100 KD).
- `GET /charades/wallet` — bearer-token protected (player session). Current
  credit balance for the signed-in player.
- `POST /charades/checkout` — player session required. Starts a top-up for
  exactly one game's worth of credit at the current price → a `payments`
  row in `initiated` status. No credit exists yet.
- `POST /charades/checkout/:paymentId/confirm` / `.../fail` — player
  session required, and the payment must belong to the caller (404
  otherwise). Stand in for a real payment provider's success/failure
  callback; confirm is idempotent (see above).
- `POST /charades/sessions` — player session required. `{ sessionId }`
  spends one credit and deals 20 titles at random across every playable
  deck combined — no `deckId`, the player never chooses one; idempotent on
  `sessionId` (see above). 402 when the balance is empty, 409 when no deck
  has any titles at all.
- `GET /charades/sessions/:id` — player session required, and the session
  must belong to the caller. Re-fetches a previously dealt session.
- `GET /admin/audit-log` — bearer-token protected. Read-only; see "Audit
  log" above.

## App integration

The app fetches `GET /charades/price` on startup (`src/services/walletApi.ts`
in the main project) — there is no offline fallback, since Charades requires
a live connection for its wallet. Point the app at a non-default server with
`EXPO_PUBLIC_CATALOGUE_API_URL` (`src/config.ts`).

An Account screen, reachable from the home screen or from the Charades
checkout screen itself, lets a player create an account or sign in
(`src/services/playerAuthApi.ts`). Playing Charades requires it — the
checkout screen (`app/charades/checkout.tsx`) routes a guest through
sign-in/sign-up first, then shows the wallet balance and the current price,
tops up via the mock payment flow, and spends one credit to deal a session
(`src/services/walletApi.ts`).

During play, the round's title and category never appear on the shared
screen (a TV, a tablet propped up, whatever device is showing
`app/charades/play.tsx`) — that screen only ever renders a QR code
(`src/engine/reveal.ts`, `react-native-qrcode-svg`). It links to this same
app's own `/charades/reveal` page with the title and both deck names in the
query string, so any phone's stock camera app recognises it and offers to
open it — no app install, no camera permission inside this app at all. The
reveal page picks whichever deck name matches its own language setting. The
link's base URL is whatever the shared screen's own page is served from when
that screen is a browser (`window.location.origin`), or
`EXPO_PUBLIC_REVEAL_BASE_URL` when it isn't (e.g. a native app mirrored to
the TV, where there's no page origin to read).

## Known gaps

- **Not deployed anywhere.** This runs locally; putting it on a real host
  with a real domain is a separate step.
- **No real payment provider.** `MockPaymentProvider` stands in until real
  KNET/aggregator merchant credentials exist — see "The wallet" above.
- **No repetition avoidance across sessions.** `startGameSession` draws 20
  random titles from the combined pool each time, with no memory of what a
  player already saw in an earlier session. Low priority while the total
  pool across every deck is large (hundreds of titles) relative to a
  20-title session, but worth revisiting if the pool ever shrinks close to
  that size.
- **No real migration framework.** Schema setup is a single `CREATE TABLE
  IF NOT EXISTS` block, run every time the server starts — which only ever
  creates a table from scratch and does nothing to a table that already
  exists from an older schema version. A column added to an existing table
  after it already shipped (like `credit_transactions.game_session_id`)
  needs its own explicit, idempotent `ALTER TABLE`, added by hand via the
  small `ensureColumn()` helper right after the `CREATE TABLE` block. Found
  the hard way: a database created before that column existed threw `table
  credit_transactions has no column named game_session_id` on every "start
  game" call, since the block above is a no-op on a table that's already
  there. Covered by `__tests__/schemaMigration.test.ts`, which builds an
  old-shaped table by hand before importing `db.ts` to prove the upgrade
  path actually runs. The next schema change that adds a column to an
  existing table needs the same treatment, not just an updated
  `CREATE TABLE`.
- **`uuid` transitive vulnerability** via `exceljs` (write path only — never
  exercised, since the server only *reads* uploaded spreadsheets). Fixing it
  means downgrading `exceljs` three major versions; not worth it for an
  unreachable code path. Re-check next time `exceljs` cuts a release.
- **A crafted docx/xlsx could be a zip bomb.** Neither the import parser nor
  multer caps decompressed size, only the upload size (10 MB). Low priority
  because deck import is admin-only, not public attack surface.
