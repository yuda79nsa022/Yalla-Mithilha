# Gap analysis

Honest status of every area covered by the production-hardening pass, as of
this writing. `IMPLEMENTED` means done and tested; `PARTIAL` means real but
incomplete, with the missing piece named; `MISSING` means not built;
`BROKEN` means built but currently wrong; `NOT APPLICABLE` means the
architecture makes the concern moot, with the reason stated.

| Area | Status | Tests Passed | Notes |
| --- | --- | --- | --- |
| Party Game | IMPLEMENTED | 126 app tests (`npm test`) | Fully offline, no account, engine is framework-free and config-table driven. |
| Mini-Games | IMPLEMENTED | Covered by the 126 above (`roundController`, `scoring`, `selector`) | Seven mini-games, one config row each; adding an eighth is a config row plus a renderer. |
| Offline Mode | IMPLEMENTED | `charades.test.ts` (app) | Party Game needs no network at all. Charades needs an account and a connection — no offline fallback, since it moves real money through a wallet. |
| Save/Resume | IMPLEMENTED | `charades.test.ts`, `charades.routes.test.ts` (server) | `CharadesState` carries a client-generated session id; resuming after a restart replays the same id and `startGameSession` no-ops on the repeat, so a resume never double-charges. |
| Charades | IMPLEMENTED | `charades.test.ts` + full server test suite | Sign up → top up wallet → purchase → play (20 rounds, two teams) → complete, end to end, server-authoritative at every money-relevant step. |
| Accounts | PARTIAL | `playerAuth.routes.test.ts`, `auth.routes.test.ts` | Sign-up/login for both players and admins, bcrypt-hashed passwords, works. Password reset is explicitly deferred (product decision: no SMTP/email provider configured) — admins stay recoverable via `npm run create-admin` on the server; a player without a session has to re-register. |
| Payments/KNET | PARTIAL | `charades.routes.test.ts` | `PaymentProvider` interface plus a fully working `MockPaymentProvider` — the checkout/confirm/fail flow is real and idempotent. Swapping in a real `KnetPaymentProvider` is explicitly deferred (product decision: no live merchant credentials yet); the interface is the seam for it. |
| Game Credits (Wallet) | IMPLEMENTED | `charades.routes.test.ts`, `db.test.ts` | Server-authoritative, append-only ledger (`SUM(grants) - SUM(consumes)`, never a mutable counter). Top-up amount equals the single admin-configurable game price (`settings.game_price_fils`, starts at 1.5 KD); no tiered packs. |
| Decks | IMPLEMENTED | `adminDecks.routes.test.ts`, `db.test.ts` | Unbounded-size decks of titles (no fixed slot count, unlike the old category board); a deck is playable as soon as it has at least one title — no separate publish gate. |
| Admin CMS | PARTIAL | `adminDecks.routes.test.ts`, `adminUsers.routes.test.ts`, `adminPlayers.routes.test.ts` | Deck/title CRUD, direct one-step import, admin-editable game price, audit log, all functionally complete. The admin UI itself (`server/public/index.html`) is English-only — the bilingual requirement was implemented across the player-facing app (`app/`, `src/i18n/`) but not extended to this internal tool. Flagged here rather than silently left out. |
| Imports | IMPLEMENTED | `adminDecks.routes.test.ts` | Upload → parse → append for docx/xlsx/pdf title lists, written directly to the deck in one step (no staged preview/commit, since there's no fixed slot count to protect from an oversized import). |
| Card Reporting | IMPLEMENTED | `contentReports.test.ts`, `reports.routes.test.ts`, `reportSyncApi.test.ts`, `reportSyncPersistence.test.ts` | On-device queue, works without an account, syncs in batches of ≤50 opportunistically, admin review groups by prompt with per-report reasons. |
| Arabic/RTL | IMPLEMENTED (app) / MISSING (admin UI) | `i18n.test.ts` | The player-facing app is fully bilingual and RTL-aware. The admin UI has no Arabic strings and no RTL layout — same gap named under Admin CMS above. |
| English/LTR | IMPLEMENTED | `i18n.test.ts` | Key-parity between `ar.ts` and `en.ts` is type-enforced (`en.ts` is `Record<TranslationKey, string>` against `ar.ts`'s keys) and test-enforced. |
| Web | IMPLEMENTED | Live Playwright verification (Pass 8) | `app/landing.tsx` is a dedicated bilingual, RTL-aware entry point served only on `Platform.OS === 'web'`; native installs still land on `/home`. |
| Authentication Security | IMPLEMENTED, one accepted gap | `auth.routes.test.ts`, `playerAuth.routes.test.ts`, `rateLimit.test.ts` | bcrypt password hashing, separate JWT secrets for admin vs. player sessions (a player token can't verify as an admin token or vice versa), rate-limited login/register. Gap: no server-side session revocation — a stolen/logged-out token stays valid until its 12h natural expiry. Accepted for now; a real fix needs a token-denylist or session store, which doesn't exist yet. |
| Authorization Security | IMPLEMENTED | Every `*.routes.test.ts` file exercises this | `requireAdminSession`/`requirePlayerSession` gate every route that needs them; payment and game-session operations additionally check the row's `playerId` against the session before acting, tested explicitly (e.g. one player can't confirm or fail another player's payment, or read another player's session). |
| API Security | IMPLEMENTED | `rateLimit.test.ts`, `errorHandling.test.ts`, all `validate.ts`-backed route tests | Rate limiting on login/register/report endpoints, `validate.ts` input checks on every mutating endpoint, `helmet` security headers. Fixed this pass: a malformed JSON body used to fall through to Express's default handler, which returns an HTML page with the full stack trace and absolute server file paths whenever `NODE_ENV` isn't exactly `production` — now caught by a terminal error middleware in `app.ts` that always replies with clean JSON. |
| Payment Security | IMPLEMENTED (within Mock scope) | `charades.routes.test.ts` | `confirmPayment`/`failPayment` use a conditional `UPDATE ... WHERE status='initiated'` as a one-shot lock, so a webhook retry can't double-grant; `checkout`/`confirm`/`fail` all verify the payment's `playerId` matches the caller's session before acting; the amount charged is the game price snapshotted at checkout time, not re-read at confirm time. Real-provider signature verification is out of scope until a real provider exists (see Payments/KNET). |
| File/Import Security | IMPLEMENTED, one accepted low-priority gap | `adminDecks.routes.test.ts` | The import route uses `multer.memoryStorage()` with a size cap and never trusts the client's filename. docx/xlsx/pdf parsing extracts text (regex over raw XML for docx, `exceljs`/`pdf-parse` for the others) rather than resolving a full XML/entity graph, so there's no XXE path. Accepted gap: no explicit cap on decompressed zip size, so a crafted docx/xlsx could be a zip bomb; low priority because the import route is admin-only (authenticated, trusted actor), not public attack surface. |
| Database Security | IMPLEMENTED | Whole server suite (115 tests) | Every query in `db.ts` is parameterized (`db.prepare(...).run({...})`/`.get({...})`) — no string-concatenated SQL anywhere in the codebase. |
| Dependency Security | PARTIAL | `npm audit` (both projects, re-run this pass) | Server: one moderate transitive `uuid` advisory via `exceljs`'s write path, which the server never exercises (read-only usage) — pre-existing, documented in `server/README.md`. App: `npm audit --production` reports 44 findings including 1 critical and 13 high, but every one traces (confirmed via `npm ls`) to `expo@51.0.39`'s own CLI/Metro-bundler build tooling (`@expo/cli`, `metro*`, `tar`, `postcss`, `xmldom`) — devtime dependencies of the Expo toolchain, not code bundled into the app players install. No shipped-app risk; worth re-checking after the next Expo SDK upgrade. |
| Privacy | IMPLEMENTED | — (documentation + `wipeEverything` covered by app tests) | Root `README.md`'s privacy section accurately lists the three things that talk to the backend (Charades' account + wallet, optional account creation for the free game, report sync) and states plainly that guest play and the Party Game need none of them. One-tap local wipe exists. No camera/mic/contacts/location permission is declared. Analytics events are typed so a name or prompt string cannot be attached. |
| Packaging | MISSING | — | `docs/PRODUCTION_CHECKLIST.md` (pre-existing, not part of this pass) still lists unchecked store-submission items: app icon/splash/adaptive icon, licensed fonts, sound effects, store screenshots, an accessibility pass, a privacy-policy URL, age-rating questionnaires, and (now that real payments exist) a restore-purchases flow required by both app stores. None of this blocks local use or testing; all of it blocks an actual store submission. |

## What changed in this security pass specifically

Beyond re-confirming the areas above by reading the current code (not just
recalling earlier passes), this pass found and fixed two real bugs:

1. **Stored XSS in the admin category list.** `showList()`'s row template
   in `server/public/index.html` interpolated `nameEn`/`nameAr` (free-text,
   admin-entered) into `innerHTML` without `escapeHtml()`, unlike every
   other table in that file. Confirmed live: a category named
   `<img src=x onerror=alert(1)>` rendered as inert text and fired no
   dialog once fixed; it would have executed before the fix. Fixed and
   pushed.
2. **Stack-trace leakage on malformed JSON.** No terminal error handler
   existed in `app.ts`, so a bad JSON body reached Express's own default
   handler, which serves an HTML page with the full stack trace and
   absolute file paths whenever `NODE_ENV` isn't exactly `production`.
   Added a middleware that always replies with clean JSON instead; verified
   both with a Jest regression test and a live request against a running
   dev server. Fixed and pushed.

Everything else in the checklist above (SQL injection, CORS, CSRF, secrets,
authorization boundaries, payment idempotency, file-upload handling) was
read end-to-end this pass and found already correct from earlier passes —
no further changes were needed there.

### CORS / CSRF, specifically

Sessions are bearer JWTs sent in an `Authorization` header — there is no
cookie-based session anywhere in the server. CSRF is **not applicable**
under this design: a CSRF attack relies on a browser automatically
attaching ambient credentials (cookies) to a cross-origin request; a bearer
token is never attached automatically, so a malicious page cannot ride a
victim's session without already having the token (which would mean an XSS
compromise, a separately-covered row above). CORS is deliberately open
(`Access-Control-Allow-Origin: *`) on the routes meant to be called from
the app running as a web page (`/charades/decks`, `/charades/price`,
`/players`, `/reports`) and left closed (no CORS headers, same-origin only) on
`/admin/*`, which the admin UI only ever calls from the page it's served
from.

### Secrets

`SESSION_SECRET` and `PLAYER_SESSION_SECRET` have no insecure default —
`auth.ts` throws rather than signing a token if either is unset. `.env` is
git-ignored in both the server and the root project; only `.env.example`
(documentation, no real values) is tracked. A repo-wide search for
hardcoded key material (`sk_live`, `AKIA`, PEM headers, an inline
`SESSION_SECRET = "..."`) found nothing.
