#!/usr/bin/env bash
#
# installer.sh — setup script for Yalla Mithilha
#
# What it does:
#   1. Installs npm dependencies for the Expo app (root) and the admin
#      server (server/), unless skipped.
#   2. Ensures server/.env exists (copied from server/.env.example, with
#      SESSION_SECRET / PLAYER_SESSION_SECRET auto-generated if blank),
#      and pins the server's PORT (default 8096 — 8081 is taken on this
#      host, see --port to change it).
#   3. Checks whether the SQLite database already exists at the configured
#      path:
#        - if it exists          -> leave it untouched
#        - if it does not exist  -> create it (runs the server's own
#          schema-creation code via `db.ts`, which is idempotent), then
#          optionally seeds the starter decks and creates the first admin
#          account.
#   4. Builds the server and attaches it to pm2 as process "yalla" (starts
#      it if not already running, restarts it if it is), unless skipped.
#
# Usage:
#   ./installer.sh [options]
#
# Options:
#   --skip-app-install    Skip `npm install` for the root Expo app
#   --skip-server-install Skip `npm install` for the server
#   --seed                 Load the bundled starter decks (safe to re-run)
#   --non-interactive       Never prompt (skip admin-account creation prompt)
#   --port <n>              Server port to write into server/.env (default: 8096)
#   --skip-pm2              Don't build or attach the server to pm2
#   -h, --help              Show this help and exit
#
set -euo pipefail

# ------------------------------------------------------------------ colors --
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_BLUE=$'\033[34m'
else
  C_RESET=""; C_BOLD=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_BLUE=""
fi

info()  { printf "%s[info]%s  %s\n"  "$C_BLUE"   "$C_RESET" "$1"; }
ok()    { printf "%s[ ok ]%s  %s\n"  "$C_GREEN"  "$C_RESET" "$1"; }
warn()  { printf "%s[warn]%s  %s\n"  "$C_YELLOW" "$C_RESET" "$1"; }
error() { printf "%s[fail]%s  %s\n"  "$C_RED"    "$C_RESET" "$1" >&2; }
die()   { error "$1"; exit 1; }

# -------------------------------------------------------------------- args --
SKIP_APP_INSTALL=false
SKIP_SERVER_INSTALL=false
DO_SEED=false
NON_INTERACTIVE=false
SKIP_PM2=false
# 8081 (the usual default) is already in use on this host — 8096 instead.
SERVER_PORT="8096"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-app-install)    SKIP_APP_INSTALL=true ;;
    --skip-server-install) SKIP_SERVER_INSTALL=true ;;
    --seed)                DO_SEED=true ;;
    --non-interactive)     NON_INTERACTIVE=true ;;
    --skip-pm2)            SKIP_PM2=true ;;
    --port)
      SERVER_PORT="${2:-}"
      [[ -n "$SERVER_PORT" ]] || die "--port requires a value"
      shift
      ;;
    -h|--help)
      # Print only the header comment block (before the first blank-then-code
      # line), not every inline comment further down in the script.
      awk '/^#!/{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
      exit 0
      ;;
    *)
      die "Unknown option: $1 (use --help for usage)"
      ;;
  esac
  shift
done

# -------------------------------------------------------------------- paths --
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"

[[ -d "$SERVER_DIR" ]] || die "Expected a 'server' directory next to this script (run it from the repo root)."

# --------------------------------------------------------- required tools --
command -v node >/dev/null 2>&1 || die "node is required but not found in PATH."
command -v npm  >/dev/null 2>&1 || die "npm is required but not found in PATH."
NODE_VERSION="$(node -v)"
info "Using node $NODE_VERSION"

gen_secret() {
  # 48 bytes of randomness, hex-encoded. Falls back if openssl is missing.
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 48
  else
    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  fi
}

# --------------------------------------------------------- npm install(s) --
if [[ "$SKIP_APP_INSTALL" == false ]]; then
  info "Installing Expo app dependencies (root)…"
  (cd "$ROOT_DIR" && npm install)
  ok "Root dependencies installed."
else
  warn "Skipping root app npm install (--skip-app-install)."
fi

if [[ "$SKIP_SERVER_INSTALL" == false ]]; then
  info "Installing admin server dependencies (server/)…"
  (cd "$SERVER_DIR" && npm install)
  ok "Server dependencies installed."
else
  warn "Skipping server npm install (--skip-server-install)."
fi

# -------------------------------------------------------------- server/.env --
ENV_FILE="$SERVER_DIR/.env"
ENV_EXAMPLE="$SERVER_DIR/.env.example"

if [[ -f "$ENV_FILE" ]]; then
  ok "server/.env already exists — leaving it as is."
else
  [[ -f "$ENV_EXAMPLE" ]] || die "server/.env.example not found; can't bootstrap server/.env."
  info "Creating server/.env from .env.example…"
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  ok "server/.env created."
fi

# Set KEY=VALUE in server/.env unconditionally — adds the line if it's
# missing, overwrites it if it's already there.
set_env_kv() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    local tmp
    tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" -F= 'BEGIN{OFS="="} $1==k{$0=k"="v} {print}' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    printf "%s=%s\n" "$key" "$value" >> "$ENV_FILE"
  fi
}

# Fill in SESSION_SECRET / PLAYER_SESSION_SECRET if they're blank — the
# server refuses to serve /admin/* or /players/* routes without them.
fill_secret_if_blank() {
  local key="$1"
  local current
  current="$(grep -E "^${key}=" "$ENV_FILE" | head -n1 | cut -d= -f2- || true)"
  if [[ -z "${current// /}" ]]; then
    set_env_kv "$key" "$(gen_secret)"
    ok "Generated a random $key."
  fi
}
fill_secret_if_blank "SESSION_SECRET"
fill_secret_if_blank "PLAYER_SESSION_SECRET"

# 8081 is already taken on this host, so the server is pinned to 8096
# (override with --port). Unconditional: this is an explicit deployment
# choice, not a "fill if blank" default.
set_env_kv "PORT" "$SERVER_PORT"
ok "Server PORT set to $SERVER_PORT in server/.env."

# ---------------------------------------------------- resolve the DB path --
# Mirrors server/src/db.ts: DATA_DIR defaults to <server>/data, DB_PATH
# defaults to <DATA_DIR>/catalogue.sqlite. Both are overridable via .env,
# so read them from there (falling back to the same defaults db.ts uses).
env_value() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- || true
}

DATA_DIR_VAL="$(env_value DATA_DIR)"
DATA_DIR_VAL="${DATA_DIR_VAL:-$SERVER_DIR/data}"
# Resolve a relative DATA_DIR against the server directory, like Node would
# when running with server/ as the CWD.
case "$DATA_DIR_VAL" in
  /*) ;; # already absolute
  *) DATA_DIR_VAL="$SERVER_DIR/$DATA_DIR_VAL" ;;
esac

DB_PATH_VAL="$(env_value DB_PATH)"
DB_PATH_VAL="${DB_PATH_VAL:-$DATA_DIR_VAL/catalogue.sqlite}"
case "$DB_PATH_VAL" in
  /*) ;;
  *) DB_PATH_VAL="$SERVER_DIR/$DB_PATH_VAL" ;;
esac

# ------------------------------------------------------------- db present? --
if [[ -f "$DB_PATH_VAL" ]]; then
  ok "Database already exists at $DB_PATH_VAL — leaving it untouched."
else
  info "No database found at $DB_PATH_VAL — setting it up…"
  mkdir -p "$DATA_DIR_VAL"

  # server/src/db.ts creates every table (CREATE TABLE IF NOT EXISTS) and
  # seeds the single settings row purely as an import-time side effect, so
  # just loading that module through the server's own env vars builds the
  # full schema. Runs from server/ so relative requires resolve normally.
  (
    cd "$SERVER_DIR"
    export DATA_DIR="$DATA_DIR_VAL"
    export DB_PATH="$DB_PATH_VAL"
    npx --yes tsx -e "require('./src/db.ts')"
  )

  if [[ -f "$DB_PATH_VAL" ]]; then
    ok "Database created at $DB_PATH_VAL"
  else
    die "Database setup ran but $DB_PATH_VAL still wasn't created — check the output above."
  fi

  if [[ "$DO_SEED" == true ]]; then
    info "Loading starter decks (seed-decks)…"
    (cd "$SERVER_DIR" && npm run seed-decks)
    ok "Starter decks loaded."
  fi

  if [[ "$NON_INTERACTIVE" == false && -t 0 ]]; then
    echo
    read -r -p "Create the first admin account now? [Y/n] " CREATE_ADMIN
    CREATE_ADMIN="${CREATE_ADMIN:-Y}"
    if [[ "$CREATE_ADMIN" =~ ^[Yy] ]]; then
      read -r -p "  admin username: " ADMIN_USER
      read -r -s -p "  admin password (min 8 chars): " ADMIN_PASS
      echo
      (
        cd "$SERVER_DIR"
        export DATA_DIR="$DATA_DIR_VAL"
        export DB_PATH="$DB_PATH_VAL"
        npm run create-admin -- --username="$ADMIN_USER" --password="$ADMIN_PASS"
      )
    else
      warn "No admin account created yet — run this later:"
      warn "  (cd server && npm run create-admin -- --username=<name> --password=<pass>)"
    fi
  else
    warn "Non-interactive — no admin account created yet. Run this later:"
    warn "  (cd server && npm run create-admin -- --username=<name> --password=<pass>)"
  fi
fi

# --------------------------------------------------------- pm2 attach --
PM2_ATTACHED=false
if [[ "$SKIP_PM2" == false ]]; then
  if ! command -v pm2 >/dev/null 2>&1; then
    info "pm2 not found — installing it globally (npm install -g pm2)…"
    if npm install -g pm2 >/tmp/pm2-install.log 2>&1; then
      ok "pm2 installed."
    else
      warn "Couldn't install pm2 globally (log: /tmp/pm2-install.log). Skipping process manager setup."
      warn "Install it yourself, then run:"
      warn "  (cd server && npm run build && pm2 start dist/src/index.js --name yalla)"
    fi
  fi

  if command -v pm2 >/dev/null 2>&1; then
    info "Building server (npm run build)…"
    (cd "$SERVER_DIR" && npm run build)
    # tsc only compiles .ts -> dist/; it never copies static assets, so the
    # admin UI's public/index.html has to be mirrored into dist/public by
    # hand or app.ts's `express.static(path.join(__dirname, '..', 'public'))`
    # (which resolves to dist/public from the compiled dist/src/app.js)
    # finds nothing there and every route falls through to Express's own
    # 404 handler — "Cannot GET /". Re-copied on every build so edits to
    # public/ aren't silently left stale in dist/.
    rm -rf "$SERVER_DIR/dist/public"
    cp -r "$SERVER_DIR/public" "$SERVER_DIR/dist/public"
    ok "Server built (static assets synced to dist/public)."

    info 'Attaching server to pm2 as "yalla"…'
    if pm2 describe yalla >/dev/null 2>&1; then
      (cd "$SERVER_DIR" && pm2 restart yalla --update-env)
      ok 'pm2 process "yalla" restarted.'
    else
      # tsc's rootDir is "." (it also compiles __tests__), so the compiled
      # entry point lands at dist/src/index.js, not dist/index.js.
      (cd "$SERVER_DIR" && pm2 start dist/src/index.js --name yalla)
      ok 'pm2 process "yalla" started.'
    fi
    pm2 save >/dev/null 2>&1 || warn "pm2 save failed — the process list won't auto-resurrect on reboot."
    PM2_ATTACHED=true
  fi
else
  warn "Skipping pm2 setup (--skip-pm2)."
fi

# ------------------------------------------------------------------- done --
echo
ok "Setup complete."
if [[ "$PM2_ATTACHED" == true ]]; then
  echo "  Server running under pm2 as \"yalla\": http://localhost:${SERVER_PORT}"
  echo "    Logs:     pm2 logs yalla"
  echo "    Status:   pm2 status"
  echo "    Restart:  pm2 restart yalla"
else
  echo "  Start the admin server:  (cd server && npm run dev)     -> http://localhost:${SERVER_PORT}"
fi
echo "  Start the Expo app:      npm start"
[[ "$DO_SEED" == false ]] && echo "  Load starter decks:      (cd server && npm run seed-decks)"
