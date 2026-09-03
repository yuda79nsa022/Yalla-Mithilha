# Board catalogue admin server

A small, separate Node/Express/TypeScript backend for managing the board-game
category catalogue — add/edit/delete categories and tiles, bulk-import title
lists from .docx/.xlsx/.pdf, and serve the finished content live to the app.
Not part of the Expo app's dependency graph; nothing here is bundled into the
mobile/web build.

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
ADMIN_TOKEN=some-secret npm run dev   # starts on :4000 by default
```

Open `http://localhost:4000/` for the admin UI — it asks for the same
`ADMIN_TOKEN` and uses it as a bearer token on every `/admin/*` call.

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
| `ADMIN_TOKEN` | — | Required for any `/admin/*` route. The server 500s on those routes if unset, rather than silently running unauthenticated. |
| `DATA_DIR` | `./data` | Where the SQLite file lives. |
| `DB_PATH` | `<DATA_DIR>/catalogue.sqlite` | Override the exact file — tests set this to an isolated temp path. |

## Auth model

One shared bearer token via `ADMIN_TOKEN`, checked in `src/auth.ts`. That's
appropriate for a small content team, not a multi-role permission system —
if this grows past a couple of trusted admins, that's the first thing to
replace.

## API shape

- `GET /catalogue` — public, no auth, CORS-open (the app fetches this from a
  different origin when running as a web page). Returns only complete
  categories, in the same shape the client's `CategoryDeck[]` expects.
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
  category/type labels all get filtered out this way). One known artifact: a
  table's own header row usually survives as a stray "title" too — harmless,
  an admin recognizes and discards it on sight.

## App integration

The app fetches `GET /catalogue` on startup (`src/services/catalogueApi.ts`
in the main project), caches the result in `AsyncStorage`, and falls back to
the bundled static catalogue (`src/content/board` in the main project) if
the fetch fails or there's no cache yet — so a fresh offline install still
has a working board mode. Point the app at a non-default server with
`EXPO_PUBLIC_CATALOGUE_API_URL` (`src/config.ts`).

## Known gaps

- **Not deployed anywhere.** This runs locally; putting it on a real host
  with a real domain is a separate step.
- **`uuid` transitive vulnerability** via `exceljs` (write path only — never
  exercised, since the server only *reads* uploaded spreadsheets). Fixing it
  means downgrading `exceljs` three major versions; not worth it for an
  unreachable code path. Re-check next time `exceljs` cuts a release.
- No media upload support yet (image/audio/reorder tile types exist in the
  schema but nothing here lets you attach an asset to one).
