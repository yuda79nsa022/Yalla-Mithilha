# Board catalogue admin server

A small, separate Node/Express/TypeScript backend for managing the board-game
category catalogue — add/edit/delete categories and tiles, upload a cover
image per category, bulk-import title lists from .docx/.xlsx/.pdf, manage
admin accounts, manage optional player accounts, and serve the finished
content live to the app. Not part of the Expo app's dependency graph;
nothing here is bundled into the mobile/web build.

## The one rule that matters

**A category is only ever returned by `GET /catalogue` once it is BOTH
`published` AND complete** (all six tiles have real, non-empty Arabic/English
prompt and answer). These are two independent gates, both enforced in
`listCompleteCategories()` (`src/db.ts`), not just by convention — an admin
publishing an incomplete category by mistake still can't leak it, and a
complete-but-still-draft category (the default for anything new or imported)
can sit in the admin UI indefinitely with zero risk of reaching a real game.

## Content states

Every category has a `status`: `draft` (default — nothing publishes itself,
imported or not), `published` (eligible for `GET /catalogue`, subject to the
completeness gate above), or `archived` (pulled back out, without deleting
it). Change it with `PUT /admin/categories/:id/status`. There is no separate
version-history table — the audit log (below) already records every
`category.update`/`tile.update`/`category.status.*` with a before/after
snapshot, which is the same information a dedicated versions table would
hold, without a second source of truth to keep in sync.

## Staged import review

`POST /admin/categories/:id/import` used to parse a file and commit straight
to the database in one request — nothing stood between an admin's upload and
possibly thousands of new tile prompts landing live. It's now two steps:

1. `POST /admin/categories/:id/import/preview` (multipart, field `file`) —
   parses the file and returns what *would* be filled (`proposed`, in
   drafted order) and how many titles are left over (`skipped`). Writes
   nothing. Each proposed title is checked against every existing tile's
   Arabic prompt (`findTitleMatches` in `src/db.ts`) and flagged with
   `duplicates: [{ categoryId, categoryNameEn, tileIndex }, ...]` when one
   matches — surfaced for review, never deleted or skipped automatically.
2. `POST /admin/categories/:id/import/commit` — `{ titles: string[] }`, the
   same list the preview proposed, sent back once an admin has actually
   looked at it. Recomputes empty slots itself rather than trusting the
   preview's tile assignments, since another admin could have filled one in
   the time between the two calls.

The admin UI's "Import titles" card walks through both steps: preview,
review (duplicates shown inline), confirm or cancel.

## Running it

```bash
npm install
export SESSION_SECRET=some-long-random-string
npm run create-admin -- --username=you --password=at-least-8-chars   # first account
npm run dev   # starts on :4000 by default
```

Open `http://localhost:4000/` for the admin UI and sign in with that account.
Once signed in, an admin can add more admin accounts from the "Admins" tab —
the CLI bootstrap is only needed for the very first one, since there's no API
route for "create an admin" without already being logged in as one.

To load the app's existing 7 hand-authored categories in (so switching to
the live backend doesn't throw away the fact-checking work already done on
that content):

```bash
npm run seed   # idempotent — skips any category id that already exists
```

## Environment variables

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4000` | |
| `SESSION_SECRET` | — | Signs admin login sessions (JWT). Required for any `/admin/*` route — the server 500s on those routes if unset, rather than silently running unauthenticated. |
| `PLAYER_SESSION_SECRET` | — | Signs player-account session tokens (JWT), entirely separate from `SESSION_SECRET` — a player token can never verify as an admin session or vice versa. Required for `/players/*` and any player-only route. |
| `DATA_DIR` | `./data` | Where the SQLite file and uploaded images live. |
| `DB_PATH` | `<DATA_DIR>/catalogue.sqlite` | Override the exact file — tests set this to an isolated temp path. |

## Auth model

Real admin accounts (username + bcrypt-hashed password), not a single shared
secret — `src/auth.ts` + the `admin_users` table. `POST /admin/auth/login`
exchanges credentials for a 12-hour JWT; every other `/admin/*` route
requires it as a bearer token. Any signed-in admin can list, add, rename,
change the password of, or delete any other admin (`/admin/users`) — flat,
no roles, appropriate for a small trusted content team. The one guard rail:
deleting the last remaining admin account is refused, so nobody can lock
everyone out of the dashboard by mistake.

Player accounts are a separate, optional system for people actually playing
the game — not the CMS. `src/auth.ts` + the `players` table, signed with
their own `PLAYER_SESSION_SECRET`. `POST /players/register` and
`POST /players/login` are public and exchange a username/password for a
12-hour JWT. Guest play in the app never touches this — it only exists for
someone who chooses to create an account. Admins can list, rename, reset the
password of, and delete any player account (`/admin/players`); unlike admin
accounts, there's no "last remaining account" guard, since deleting every
player carries no lockout risk.

## Payments and board-game credits

A paid Board Game credit is owned by a player's account, never by a device —
`payments`, `board_games` and an append-only `credit_transactions` ledger in
`src/db.ts`. A balance is always the sum of grants minus the sum of
consumes, never a mutable counter, so it can't drift from its own history.

Checkout logic (`src/routes/boardGames.ts`) is written against a
`PaymentProvider` interface (`src/payments/provider.ts`), not a specific
gateway's SDK. Right now that interface is implemented by
`MockPaymentProvider` — there is no real KNET/aggregator integration yet, by
design, until real merchant credentials exist. Swapping in a real
`KnetPaymentProvider` later is meant to be an isolated change: the provider
would additionally need to return a real redirect URL from `createCheckout`,
and a real payment confirmation would come from a signature-verified webhook
route rather than the player's own authenticated `confirm` call (see the
comment on `PaymentProvider` for exactly what that requires).

Both the "duplicate webhook" and "resume an interrupted game" cases are
handled explicitly, not just by convention:

- `confirmPayment` grants credits via a conditional
  `UPDATE ... WHERE status='initiated'` — it can only ever succeed once per
  payment, so calling confirm twice (a retried callback) never double-grants.
- `consumeCreditForBoardGame` is idempotent on `board_games.id`, which is the
  *client's own* locally-drafted `BoardState.id`. Replaying the same id after
  an app restart returns the existing row and spends nothing further, so
  resuming a paid game never charges a second credit.

Pricing (`PRODUCTS` in `src/types.ts`) is placeholder, same status as the
old "$6.99/$12.99" dev-stub labels it replaced — real KWD pricing is a
business decision for whoever owns the KNET merchant account.

## Audit log

Every sensitive admin action — category/tile create, update, delete, image
upload/remove, bulk import, admin and player account create/rename/delete —
is recorded in an append-only `audit_log` table (`recordAudit` in
`src/db.ts`): who (actor id and a *snapshotted* username, so a later rename
or deletion never rewrites history), what action, what target, and a
before/after JSON snapshot where one is meaningful. It is deliberately
read-only from the API and the admin UI's new "Audit log" tab — there is no
edit or delete route for it, on purpose. A password is never written to it,
only whether one changed (`passwordChanged: true/false`); this is asserted
by a test, not just a convention. Logging itself can never fail the action
it's logging — `recordAudit` catches and logs its own errors rather than
throwing.

## API shape

- `GET /catalogue` — public, no auth, CORS-open (the app fetches this from a
  different origin when running as a web page). Returns only complete
  categories, in the same shape the client's `CategoryDeck[]` expects, with
  `imageUrl` as an absolute URL when a category has a cover image.
- `POST /admin/auth/login` — public. `{ username, password }` →
  `{ token, user }`.
- `GET/POST/PUT/DELETE /admin/users[/:id]` — bearer-token protected. Manage
  admin accounts. Never returns a password hash.
- `POST /players/register` / `POST /players/login` — public, CORS-open (same
  reasoning as `/catalogue` — called cross-origin from the app running as a
  web page; a JSON POST also triggers a CORS preflight, so `OPTIONS` gets an
  explicit response too). `{ username, password }` → `{ token, player }`.
  Never returns a password hash.
- `GET/PUT/DELETE /admin/players[/:id]` — bearer-token protected (admin
  session, not a player session). List, rename, reset the password of, or
  delete a player account. No route to create one here — accounts are
  created by the player themselves via `/players/register`.
- `GET/POST/PUT/DELETE /admin/categories[/:id]` — bearer-token protected.
  Creating a category makes six empty, `needsContent` tile slots (points
  100-600) automatically.
- `PUT /admin/categories/:id/tiles/:index` — edit one tile (index 0-5).
  `needsContent` flips to `false` automatically once all four text fields
  (promptAr/En, answerAr/En) are non-empty — you never set that flag by hand.
- `PUT /admin/categories/:id/status` — bearer-token protected.
  `{ status: 'draft' | 'published' | 'archived' }`. See "Content states"
  above.
- `POST /admin/categories/:id/import/preview` — multipart upload, field name
  `file`, `.docx`/`.xlsx`/`.pdf`. Parses out a list of titles and returns
  what would fill empty slots, plus likely duplicates — writes nothing. See
  `src/import/parseTitles.ts` for exactly how titles are picked out of a
  table — the short version: the title is the only cell per row that's both
  non-numeric and not a highly-repeated value (row numbers, years, and
  category/type labels all get filtered out this way, computed globally
  *before* picking a title per row — a long repeated label can outrank and
  displace a short real title otherwise). One known artifact: a table's own
  header row usually survives as a stray "title" too — harmless, an admin
  recognizes and discards it on sight.
- `POST /admin/categories/:id/import/commit` — `{ titles: string[] }`, JSON
  body (no file — the file was already parsed by `/preview`). Actually fills
  empty slots, in order — **never** overwrites a tile that already has
  content. Fills the Arabic prompt only; English prompt and both answers
  still need a human (or an LLM doing real fact-checking) afterward. See
  "Staged import review" above.
- `POST /admin/categories/:id/image` — multipart upload, field name `image`,
  jpeg/png/webp/gif up to 5MB. Stored under `<DATA_DIR>/uploads` with a
  generated filename (the client's filename is never trusted as part of a
  path). Replaces and deletes any previous image for that category.
- `DELETE /admin/categories/:id/image` — removes the cover image; a no-op,
  not an error, if there wasn't one.
- `GET /board-games/credits` — bearer-token protected (player session).
  Current credit balance for the signed-in player.
- `POST /board-games/checkout` — player session required. `{ product: 'single' | 'bundle2' }`
  → a `payments` row in `initiated` status. No credits exist yet.
- `POST /board-games/checkout/:paymentId/confirm` / `.../fail` — player
  session required, and the payment must belong to the caller (404
  otherwise). Stand in for a real payment provider's success/failure
  callback; confirm is idempotent (see above).
- `POST /board-games/consume` — player session required. `{ boardGameId }`
  spends one credit and activates that board game; idempotent on
  `boardGameId` (see above). 402 when the balance is empty.
- `POST /board-games/:id/complete` — player session required, and the board
  game must belong to the caller. Marks it completed.
- `GET /admin/audit-log` — bearer-token protected. Read-only; see "Audit
  log" above.
- `POST /reports` — public, CORS-open (same reasoning as `/catalogue` and
  `/players` — reporting a card never requires an account). `{ reports: [{
  id, promptId, reason, lang, createdAt, appVersion? }, ...] }`, capped at
  50 per batch. Idempotent per report `id` — see "Content report sync"
  below.
- `GET /admin/reports` — bearer-token protected. Raw list, most-recent
  first; the admin UI's "Reports" tab groups and counts them per card.
- `PUT /admin/reports/by-prompt/:promptId/status` — bearer-token protected.
  `{ status: 'open' | 'resolved' | 'dismissed' }`. Bulk-updates every
  currently-open report for that card at once; already-resolved/dismissed
  reports are left alone.

## Content report sync

The Party Game's card-report feature (`report.title` etc. in the app) used
to be entirely local — saved on-device, never seen by anyone but the
player. It's now an offline queue that syncs here, the same offline-first
shape as the catalogue fetch: the app tries to sync a report right after
it's filed, and retries whatever is still queued on next launch. Neither
path blocks anything or requires a player session — reporting a card never
needs an account, online or offline.

`POST /reports` is idempotent per report id (`INSERT OR IGNORE` in
`submitContentReports`, `src/db.ts`), so a retried sync after a dropped
connection never creates a duplicate row. No player identity of any kind is
stored — only which card, why, the language, roughly which app version, and
when. An admin reviews and resolves/dismisses a card's reports together via
`PUT /admin/reports/by-prompt/:promptId/status`, not one row at a time,
since that's how the report list is actually used.

## App integration

The app fetches `GET /catalogue` on startup (`src/services/catalogueApi.ts`
in the main project), caches the result in `AsyncStorage`, and falls back to
the bundled static catalogue (`src/content/board` in the main project) if
the fetch fails or there's no cache yet — so a fresh offline install still
has a working board mode. Point the app at a non-default server with
`EXPO_PUBLIC_CATALOGUE_API_URL` (`src/config.ts`). The home screen renders a
scrollable row of category thumbnails from the live catalogue — a themed
color block stands in for any category without an uploaded image yet.

Reachable from Settings, an optional Account screen lets a player create an
account or sign in (`src/services/playerAuthApi.ts` in the main project).
Guest play needs none of this and keeps working exactly as before — signing
up only saves a username/session token on-device so the player can come back
to it later.

Buying Board Game credits requires that same player session — the checkout
screen (`app/board/checkout.tsx`) routes a guest through sign-in/sign-up
first. Drafting a board and playing it stay fully client-side either way;
only the credit balance and the act of spending one talk to the server
(`src/services/boardPaymentApi.ts` in the main project).

## Known gaps

- **Not deployed anywhere.** This runs locally; putting it on a real host
  with a real domain is a separate step.
- **The `status` column migration backfills existing installs once.** The
  first time a server with an older database starts after this change, any
  category that was already complete (and therefore already public under
  the old completeness-only rule) is automatically set to `published`, so
  existing content doesn't silently vanish from the catalogue. This runs
  exactly once, guarded by the same migration check as the `ALTER TABLE`
  itself — a later admin choice to draft or archive something is never
  overwritten on a subsequent restart.
- **No real payment provider.** `MockPaymentProvider` stands in until real
  KNET/aggregator merchant credentials exist — see "Payments and board-game
  credits" above.
- **`uuid` transitive vulnerability** via `exceljs` (write path only — never
  exercised, since the server only *reads* uploaded spreadsheets). Fixing it
  means downgrading `exceljs` three major versions; not worth it for an
  unreachable code path. Re-check next time `exceljs` cuts a release.
- No audio/reorder tile media upload yet — only category cover images.
- Uploaded images are stored on local disk, not object storage — fine for
  one server, won't survive a redeploy or scale past a single instance.
- **Live catalogue fetch can overwrite a good offline fallback with an empty
  one.** If the server is reachable but has zero published categories yet
  (a fresh/unseeded install), `GET /catalogue` returns `200 []` — a
  successful fetch — and the app replaces its bundled fallback catalogue
  with that empty result instead of keeping the fallback. Found live while
  testing the checkout flow against an unseeded dev server. Not yet fixed;
  the real fix is catalogue versioning with an atomic fetch→validate→switch
  update, so an empty or invalid response never displaces a good cache.
