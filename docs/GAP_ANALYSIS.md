# Gap analysis

Honest status of every area covered by the production-hardening pass, as of
this writing. `IMPLEMENTED` means done and tested; `PARTIAL` means real but
incomplete, with the missing piece named; `MISSING` means not built;
`BROKEN` means built but currently wrong; `NOT APPLICABLE` means the
architecture makes the concern moot, with the reason stated.

Yalla Mithilha is Charades — silent acting on real Kuwaiti, Khaleeji and
Egyptian movie, series and play titles. There is no free offline mode;
playing requires an account and a wallet.

| Area | Status | Tests Passed | Notes |
| --- | --- | --- | --- |
| Charades | IMPLEMENTED | `charades.test.ts` + full server test suite | Sign up → top up wallet → purchase → play (20 rounds, two teams) → complete, end to end, server-authoritative at every money-relevant step. |
| Save/Resume | IMPLEMENTED | `charades.test.ts`, `charades.routes.test.ts` (server) | `CharadesState` carries a client-generated session id; resuming after a restart replays the same id and `startGameSession` no-ops on the repeat, so a resume never double-charges. |
| QR reveal | IMPLEMENTED | Live-verified (decoded a rendered QR image against the real dealt title, three rounds) | The shared screen never renders the round's title — only a QR code linking to `/reveal`, which any phone's stock camera opens as a normal link. No camera permission inside the app itself. Deliberately not under `/charades`: a deployment that serves the player web app and the Charades API from the same origin reserves that whole prefix for the session-protected API, which would 401 an unauthenticated camera scan. |
| Accounts | PARTIAL | `playerAuth.routes.test.ts`, `auth.routes.test.ts` | Sign-up/login for both players and admins, bcrypt-hashed passwords, works. Password reset is explicitly deferred (product decision: no SMTP/email provider configured) — admins stay recoverable via `npm run create-admin` on the server; a player without a session has to re-register. |
| Payments/KNET | PARTIAL | `charades.routes.test.ts` | `PaymentProvider` interface plus a fully working `MockPaymentProvider` — the checkout/confirm/fail flow is real and idempotent. Swapping in a real `KnetPaymentProvider` is explicitly deferred (product decision: no live merchant credentials yet); the interface is the seam for it. |
| Game Credits (Wallet) | IMPLEMENTED | `charades.routes.test.ts`, `db.test.ts` | Server-authoritative, append-only ledger (`SUM(grants) - SUM(consumes)`, never a mutable counter). Top-up amount equals the single admin-configurable game price (`settings.game_price_fils`, starts at 1.5 KD); no tiered packs. |
| Decks | IMPLEMENTED | `adminDecks.routes.test.ts`, `db.test.ts` | Unbounded-size decks of titles; a deck is playable as soon as it has at least one title — no separate publish gate. Four real starter decks (~500 titles each) ship via `server/seed-data/decks/*.json` and `npm run seed-decks`. |
| Admin CMS | PARTIAL | `adminDecks.routes.test.ts`, `adminUsers.routes.test.ts`, `adminPlayers.routes.test.ts` | Deck/title CRUD, direct one-step import, admin-editable game price, audit log, all functionally complete. The admin UI itself (`server/public/index.html`) is English-only — the bilingual requirement was implemented across the player-facing app (`app/`, `src/i18n/`) but not extended to this internal tool. Flagged here rather than silently left out. |
| Imports | IMPLEMENTED | `adminDecks.routes.test.ts` | Upload → parse → append for docx/xlsx/pdf title lists, written directly to the deck in one step (no staged preview/commit, since there's no fixed slot count to protect from an oversized import). |
| Arabic/RTL | IMPLEMENTED (app) / MISSING (admin UI) | `i18n.test.ts` | The player-facing app is fully bilingual and RTL-aware. The admin UI has no Arabic strings and no RTL layout — same gap named under Admin CMS above. |
| English/LTR | IMPLEMENTED | `i18n.test.ts` | Key-parity between `ar.ts` and `en.ts` is type-enforced (`en.ts` is `Record<TranslationKey, string>` against `ar.ts`'s keys) and test-enforced. |
| Web | IMPLEMENTED | Live Playwright verification | Web and native both land on `/home`, Charades' own bilingual, RTL-aware hub screen. |
| Authentication Security | IMPLEMENTED, one accepted gap | `auth.routes.test.ts`, `playerAuth.routes.test.ts`, `rateLimit.test.ts` | bcrypt password hashing, separate JWT secrets for admin vs. player sessions (a player token can't verify as an admin token or vice versa), rate-limited login/register. Gap: no server-side session revocation — a stolen/logged-out token stays valid until its 12h natural expiry. Accepted for now; a real fix needs a token-denylist or session store, which doesn't exist yet. |
| Authorization Security | IMPLEMENTED | Every `*.routes.test.ts` file exercises this | `requireAdminSession`/`requirePlayerSession` gate every route that needs them; payment and game-session operations additionally check the row's `playerId` against the session before acting, tested explicitly (e.g. one player can't confirm or fail another player's payment, or read another player's session). |
| API Security | IMPLEMENTED | `rateLimit.test.ts`, `errorHandling.test.ts`, all `validate.ts`-backed route tests | Rate limiting on login/register endpoints, `validate.ts` input checks on every mutating endpoint, `helmet` security headers. A malformed JSON body is caught by a terminal error middleware in `app.ts` that always replies with clean JSON, rather than falling through to Express's default handler (which leaks a stack trace and absolute file paths outside `NODE_ENV=production`). |
| Payment Security | IMPLEMENTED (within Mock scope) | `charades.routes.test.ts` | `confirmPayment`/`failPayment` use a conditional `UPDATE ... WHERE status='initiated'` as a one-shot lock, so a webhook retry can't double-grant; `checkout`/`confirm`/`fail` all verify the payment's `playerId` matches the caller's session before acting; the amount charged is the game price snapshotted at checkout time, not re-read at confirm time. Real-provider signature verification is out of scope until a real provider exists (see Payments/KNET). |
| File/Import Security | IMPLEMENTED, one accepted low-priority gap | `adminDecks.routes.test.ts` | The import route uses `multer.memoryStorage()` with a size cap and never trusts the client's filename. docx/xlsx/pdf parsing extracts text (regex over raw XML for docx, `exceljs`/`pdf-parse` for the others) rather than resolving a full XML/entity graph, so there's no XXE path. Accepted gap: no explicit cap on decompressed zip size, so a crafted docx/xlsx could be a zip bomb; low priority because the import route is admin-only (authenticated, trusted actor), not public attack surface. |
| Database Security | IMPLEMENTED | Whole server suite (100 tests) | Every query in `db.ts` is parameterized (`db.prepare(...).run({...})`/`.get({...})`) — no string-concatenated SQL anywhere in the codebase. Schema upgrades (a column added to an existing table after it shipped) go through a small `ensureColumn()` helper — see `server/README.md`'s Known gaps for why `CREATE TABLE IF NOT EXISTS` alone isn't enough. |
| Dependency Security | PARTIAL | `npm audit` (both projects) | Server: one moderate transitive `uuid` advisory via `exceljs`'s write path, which the server never exercises (read-only usage) — pre-existing, documented in `server/README.md`. App: `npm audit --production` reports findings that trace (confirmed via `npm ls`) to `expo@51.0.39`'s own CLI/Metro-bundler build tooling — devtime dependencies of the Expo toolchain, not code bundled into the app players install. No shipped-app risk; worth re-checking after the next Expo SDK upgrade. |
| Privacy | IMPLEMENTED | — (documentation + `wipeEverything` covered by app tests) | Root `README.md`'s privacy section accurately describes what talks to the backend: account creation, wallet top-up/spend, and nothing else. One-tap local wipe exists. No camera/mic/contacts/location permission is declared — including for the QR reveal, which opens in the phone's own browser. Analytics events are typed so a name cannot be attached. |
| Packaging | MISSING | — | Store-submission items (app icon/splash/adaptive icon, store screenshots, an accessibility pass, a privacy-policy URL, age-rating questionnaires, and a restore-purchases flow once real payments exist) are all still open. None of this blocks local use or testing; all of it blocks an actual store submission. |

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
`/players`) and left closed (no CORS headers, same-origin only) on
`/admin/*`, which the admin UI only ever calls from the page it's served
from.

### Secrets

`SESSION_SECRET` and `PLAYER_SESSION_SECRET` have no insecure default —
`auth.ts` throws rather than signing a token if either is unset. `.env` is
git-ignored in both the server and the root project; only `.env.example`
(documentation, no real values) is tracked. A repo-wide search for
hardcoded key material (`sk_live`, `AKIA`, PEM headers, an inline
`SESSION_SECRET = "..."`) found nothing.

## Security review — ISO/IEC 27001 Annex A-aligned (2026-09-23)

This is a code-level control review structured around ISO/IEC 27001 Annex
A's control themes — it is **not** a certification. Certification requires
an accredited external auditor, a documented ISMS (risk register, policies,
management review cadence, staff training records) and organisational
practices no amount of code review can attest to. What follows is honest
about which of those code-level controls are actually in place today.

| Annex A theme | Status | Notes |
| --- | --- | --- |
| A.5 Access control policy | IMPLEMENTED | Two hard-separated account systems, not one system with a role flag: `admin_users` (CMS/content/settings) and `players` (gameplay/wallet only), each with its own JWT secret, so a token from one can never verify as the other (tested explicitly). Confirmed by re-reading every router mount in `app.ts`: every `/admin/*` route except the login endpoint itself (`/admin/auth`) is wrapped in `requireAdminSession`, with no gap. Within the admin side the model is deliberately flat — any signed-in admin can manage any other admin account (the one guard rail: the last remaining admin can't be deleted) — confirmed intentional, not a gap, per product decision. |
| A.8 Asset management | PARTIAL | Title/deck images are public, unauthenticated static files at `/title-images/*` — by design, since the QR-code reveal page is opened by a bare phone camera scan with no session at all (see "QR reveal" above), and the deck-picker thumbnails are shown to guests who haven't signed in yet. This is a live, open design question — see "In progress" below. |
| A.9 Cryptography | PARTIAL | Passwords (both account types) and password-reset codes are hashed, never stored in plaintext. The reveal URL, however, carries the round's title/category/image as a **plain, readable query string** (`?t=...&ca=...&img=...`) — anyone who sees the raw link (not just whoever scans the QR code) can read the answer without opening it, and the same link works forever, indefinitely reusable. Flagged as the top actionable gap from this review — see "In progress" below. |
| A.12 Operations security | IMPLEMENTED, one accepted gap | Admin actions are audit-logged (`audit_log`, append-only, self-service password resets included). No log rotation/retention policy is defined for `pm2 logs` output (operational concern, not code) — worth a runbook note whenever this deploys somewhere log volume matters. |
| A.13 Communications security | NOT APPLICABLE at the app layer | TLS termination is the reverse proxy's job (e.g. CloudPanel/nginx in front of the `pm2` process), not something `app.ts` does or should do itself — no HSTS/redirect logic was added here, consistent with that split. Confirm the actual deployment terminates TLS in front of this process; that's outside this repo to verify. |
| A.14 Secure development | IMPLEMENTED | Every query in `db.ts` is parameterized. All mutating routes validate input via `validate.ts`, throwing a typed `ValidationError` the central `errors.ts` handler turns into a clean 400 — never a raw stack trace. |
| A.15 Supplier relationships (dependencies) | IMPLEMENTED (server), PARTIAL (root app) | **Server:** `npm audit` found `adm-zip@0.6.0` (a *direct* dependency, used to parse admin-uploaded `.docx` files and image `.zip` bundles) sitting exactly on a high-severity symlink-extraction/arbitrary-file-overwrite advisory — fixed today via `npm audit fix` to `0.6.1` (already within the declared `^0.6.0` range; all 35 admin-decks tests still pass). One moderate item remains, accepted: a transitive `uuid` issue via `exceljs`'s xlsx-parsing path, unfixable without a breaking `exceljs` downgrade, and the vulnerable code path (buffer-argument UUID generation) isn't one the server's read-only xlsx-import usage exercises. **Root app:** of ~40 findings, every one traced back to its actual parent (`npm explain`) except one is pure build-time tooling (Metro bundler, `@expo/cli`, native build-config generation) that never ships inside the bundle a player's phone or browser runs — confirmed, not just assumed, this time. The one genuine exception: `@react-navigation/core → query-string@7.1.3 → decode-uri-component@0.2.2` **is** part of the shipped runtime bundle (it backs `expo-router`'s navigation internals) and carries a moderate ReDoS advisory. No safe fix exists today — npm's own suggested fix is a major `expo-router` bump (3.x → 57.x, several Expo SDK generations ahead), and `decode-uri-component@0.5.0`+ (the actual patched line) switched to a pure-ESM-only package, which would break `query-string`'s `require()` call outright rather than quietly fixing anything. Accepted, deferred to the next real Expo SDK upgrade; tracked here rather than silently dropped. |
| A.16 Incident management | MISSING (org-level) | No formal incident-response runbook exists. Not a code gap — a process document, out of scope for this repo. |
| A.18 Compliance/privacy | IMPLEMENTED | Unchanged from "Privacy" above — no undisclosed data collection, one-tap local wipe, no unused device permissions declared. |

### In progress, from this review

Two concrete follow-ups came directly out of this review and are being
built next, one at a time:

1. **Reveal URL** — replace the plain query-string link with an opaque,
   signed token; make it single-use (the server starts being involved in
   this previously-stateless page) and/or bound to the round it was issued
   for.
2. **Image auth** — decide, deliberately, what "authenticated" means for a
   page whose entire reason to exist is being opened by a bare camera scan
   with no login flow available. The practical answer for the reveal page
   is that the signed single-use token *is* the credential, since a
   username/password prompt isn't reachable from that flow. The deck-picker
   thumbnails are a separate, more literal question (should a guest who
   hasn't signed in yet see them at all?) with a real product trade-off
   against today's "guest play works fully without an account" design goal
   — tracked, not yet decided in code.
