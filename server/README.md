# Board catalogue admin server

A small, separate Node/Express/TypeScript backend for managing the board-game
category catalogue — add/edit/delete categories and tiles, upload a cover
image per category, bulk-import title lists from .docx/.xlsx/.pdf, manage
admin accounts, manage optional player accounts, and serve the finished
content live to the app. Not part of the Expo app's dependency graph;
nothing here is bundled into the mobile/web build.

## The one rule that matters

**A category is only ever returned by `GET /catalogue` once all six of its
tiles have real content** (non-empty Arabic/English prompt and answer). A
half-imported category — titles filled in, prompts/answers still blank — can
sit in the admin UI indefinitely with zero risk of reaching a real game. This
is enforced in `listCompleteCategories()` (`src/db.ts`), not just by
convention.

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
- `POST /admin/categories/:id/import` — multipart upload, field name `file`,
  `.docx`/`.xlsx`/`.pdf`. Parses out a list of titles and fills empty slots
  only, in order — **never** overwrites a tile that already has content.
  Fills the Arabic prompt only; English prompt and both answers still need a
  human (or an LLM doing real fact-checking) afterward. See
  `src/import/parseTitles.ts` for exactly how titles are picked out of a
  table — the short version: the title is the only cell per row that's both
  non-numeric and not a highly-repeated value (row numbers, years, and
  category/type labels all get filtered out this way, computed globally
  *before* picking a title per row — a long repeated label can outrank and
  displace a short real title otherwise). One known artifact: a table's own
  header row usually survives as a stray "title" too — harmless, an admin
  recognizes and discards it on sight.
- `POST /admin/categories/:id/image` — multipart upload, field name `image`,
  jpeg/png/webp/gif up to 5MB. Stored under `<DATA_DIR>/uploads` with a
  generated filename (the client's filename is never trusted as part of a
  path). Replaces and deletes any previous image for that category.
- `DELETE /admin/categories/:id/image` — removes the cover image; a no-op,
  not an error, if there wasn't one.

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

## Known gaps

- **Not deployed anywhere.** This runs locally; putting it on a real host
  with a real domain is a separate step.
- **`uuid` transitive vulnerability** via `exceljs` (write path only — never
  exercised, since the server only *reads* uploaded spreadsheets). Fixing it
  means downgrading `exceljs` three major versions; not worth it for an
  unreachable code path. Re-check next time `exceljs` cuts a release.
- No audio/reorder tile media upload yet — only category cover images.
- Uploaded images are stored on local disk, not object storage — fine for
  one server, won't survive a redeploy or scale past a single instance.
