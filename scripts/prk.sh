#!/usr/bin/env bash
# PRK launcher: install dependencies, then run Gateway, API and UI from this checkout.
# Settings come from the environment or <PRK home>/prk.env (written once by install):
#   PRK_MODEL        Gateway default model, PROVIDER/MODEL (required for start)
# PRK_PYTHON Python >= 3.9 used for the local target environment (default: python3)
# PRK_UI_HOST UI listen address (default: 127.0.0.1); the UI has no login
#   PRK_SOCKET       Gateway socket (default: the Gateway's own default under TMPDIR)
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PRK_HOME=${PRK_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}/pi-remote-kernel}
RUN=$ROOT/.runtime/prk
[ ! -f "$PRK_HOME/prk.env" ] || . "$PRK_HOME/prk.env"
[[ "$PRK_HOME" = /* ]] || PRK_HOME=$PWD/$PRK_HOME
PRK_PYTHON=${PRK_PYTHON:-python3}
PRK_UI_HOST=${PRK_UI_HOST:-127.0.0.1}
PRK_UI_PORT=${PRK_UI_PORT:-8787}
PRK_API_PORT=${PRK_API_PORT:-8788}
export PRK_HOME
COMPONENTS=(gateway api ui)

die() { echo "prk: $*" >&2; exit 1; }

main() {
  case "${1:-}" in
    install) shift; install "$@" ;;
    start) start ;;
    run) case "${2:-}" in gateway|api|ui) run "$2" ;; *) die "usage: prk.sh run ${COMPONENTS[*]}" ;; esac ;;
    stop) stop ;;
    status) status ;;
    logs) case "${2:-}" in gateway|api|ui) tail -n 100 -f "$RUN/$2.log" ;; *) die "usage: prk.sh logs ${COMPONENTS[*]}" ;; esac ;;
    *) die "usage: prk.sh install|start|stop|status|logs NAME|run NAME" ;;
  esac
}

install() {
  local confirmed=false kernelspec=()
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --gateway-stopped) confirmed=true; shift ;;
      --kernelspec-directory)
        [ "$#" -ge 2 ] && [[ "$2" = /* ]] || die "--kernelspec-directory requires an absolute path"
        kernelspec=(--kernelspec-directory "$2"); shift 2 ;;
      *) die "usage: prk.sh install [--gateway-stopped] [--kernelspec-directory ABSOLUTE_PATH]" ;;
    esac
  done
  check_node
  running gateway && die "stop the Gateway before upgrading"
  if [ -d "$PRK_HOME" ] && [ "$confirmed" != true ]; then
    die "stop all Gateways using $PRK_HOME, then pass --gateway-stopped"
  fi
  check_python
  (cd "$ROOT" && env -u NODE_ENV npm ci --include=dev --no-audit --no-fund)
  (cd "$ROOT/web" && env -u NODE_ENV npm ci --include=dev --no-audit --no-fund && env -u NODE_ENV npm run -s build)
  init_home
  node "$ROOT/scripts/migrate-pienv.mjs" --home "$PRK_HOME" "${kernelspec[@]}" --gateway-stopped
  import_tools
  [ ! -f "$ROOT/plugins/packages.json" ] || node "$ROOT/scripts/install-plugins.mjs" --bundle "$ROOT/plugins" --agent-dir "$PRK_HOME/agent"
  echo "Installed. Set PRK_MODEL and provider credentials (see below), then: scripts/prk.sh start"
  echo "  settings: $PRK_HOME/prk.env"
  echo "  provider: $PRK_HOME/agent/ (Pi agent dir: settings.json packages, provider config such as cliproxyapi.json)"
}

check_node() {
  command -v node >/dev/null || die "node >= 22.19 is required"
  node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=19)?0:1)' \
    || die "node >= 22.19 is required (found $(node --version))"
}

check_python() {
  command -v "$PRK_PYTHON" >/dev/null || die "Python >= 3.9 is required (set PRK_PYTHON)"
  "$PRK_PYTHON" -c 'import sys; sys.exit(sys.version_info < (3, 9))' || die "Python >= 3.9 is required (found $("$PRK_PYTHON" --version))"
  PRK_PYTHON=$("$PRK_PYTHON" -c 'import sys; print(sys.executable)')
}

# A fresh home gets one local instance on this machine; an existing home is left untouched.
init_home() {
  mkdir -p "$PRK_HOME/agent"
  [ ! -e "$PRK_HOME/config.json" ] && [ ! -e "$PRK_HOME/instances.json" ] \
    || die "legacy JSON configuration found; run node $ROOT/scripts/migrate-config-toml.mjs --home $PRK_HOME"
  [ -f "$PRK_HOME/config.toml" ] || : > "$PRK_HOME/config.toml"
  if [ ! -f "$PRK_HOME/instances.toml" ]; then
    (cd "$ROOT" && umask 077 && node --input-type=module - "$PRK_HOME/instances.toml" "$PRK_PYTHON" "$HOME" "$(hostname)" <<'EOF'
import { writeFileSync } from "node:fs";
import { stringify } from "smol-toml";
const [path, python, cwd, label] = process.argv.slice(2);
const instance = { id: "default", label, local: true, python, cwd };
writeFileSync(path, stringify({ instances: [instance] }), { mode: 0o600 });
EOF
    )
  fi
  [ -f "$PRK_HOME/prk.env" ] || cat > "$PRK_HOME/prk.env" <<'EOF'
# Sourced by scripts/prk.sh. Example: PRK_MODEL=clp/claude-opus-5-5
PRK_MODEL=
#PRK_PYTHON=python3
#PRK_UI_HOST=127.0.0.1
#PRK_UI_PORT=8787
EOF
}


# Copy a bundled artifact store only into a home that has no existing assets.
import_tools() {
  [ -f "$ROOT/assets/manifest.json" ] && [ -d "$ROOT/assets/store" ] || return 0
  [ ! -e "$PRK_HOME/assets" ] || return 0
  mkdir -p "$PRK_HOME/assets"
  cp -a "$ROOT/assets/manifest.json" "$ROOT/assets/store" "$PRK_HOME/assets/"
}

start() {
  installed
  mkdir -p "$RUN"
  local socket=()
  [ -z "${PRK_SOCKET:-}" ] || socket=(--socket "$PRK_SOCKET")
  component gateway; launch gateway "${CMD[@]}"
  # The web command exits when no Gateway answers; a first start also installs the agent's provider packages.
  wait_until gateway 600 node "$ROOT/src/main.ts" attach workbench "${socket[@]}"
  component api; launch api "${CMD[@]}"
  wait_http api "http://127.0.0.1:$PRK_API_PORT/api/workbench" 200
  component ui; (cd "$ROOT/web" && launch ui "${CMD[@]}")
  wait_http ui "http://127.0.0.1:$PRK_UI_PORT/" 200
  echo "PRK is up: http://$PRK_UI_HOST:$PRK_UI_PORT/"
}

# One component in the foreground, for a service manager (scripts/systemd/); it owns restarts and logs.
run() {
  installed
  component "$1"
  [ "$1" != ui ] || cd "$ROOT/web"
  exec "${CMD[@]}"
}

installed() {
  [ -n "${PRK_MODEL:-}" ] || die "PRK_MODEL is not set (edit $PRK_HOME/prk.env)"
  [ -d "$ROOT/node_modules" ] && [ -d "$ROOT/web/dist" ] || die "run scripts/prk.sh install first"
}

# Sets CMD to the command line of a component; start and run share it.
component() {
  local socket=()
  [ -z "${PRK_SOCKET:-}" ] || socket=(--socket "$PRK_SOCKET")
  case "$1" in
    gateway) CMD=(node "$ROOT/src/main.ts" gateway --model "$PRK_MODEL" "${socket[@]}") ;;
    api) CMD=(node "$ROOT/src/main.ts" web --host 127.0.0.1 --port "$PRK_API_PORT" "${socket[@]}") ;;
    ui) CMD=(env PRK_API="http://127.0.0.1:$PRK_API_PORT" npx vite preview --host "$PRK_UI_HOST" --port "$PRK_UI_PORT" --strictPort) ;;
  esac
}

launch() {
  local name=$1; shift
  if running "$name"; then echo "$name already running (pid $(cat "$RUN/$name.pid"))"; return; fi
  setsid "$@" >> "$RUN/$name.log" 2>&1 < /dev/null &
  echo $! > "$RUN/$name.pid"
}

# Waits until the URL answers with a status matching the pattern.
wait_http() {
  local name=$1 url=$2 expected=$3
  wait_until "$name" 120 bash -c '[[ $(curl -s -o /dev/null -w "%{http_code}" "$1") =~ ^($2)$ ]]' _ "$url" "$expected"
}

# Polls a readiness command every half second, failing early when the component's process is gone.
wait_until() {
  local name=$1 tries=$2; shift 2
  for _ in $(seq "$tries"); do
    running "$name" || die "$name exited; see $RUN/$name.log"
    "$@" >/dev/null 2>&1 && return
    sleep 0.5
  done
  die "$name is not ready after $((tries / 2))s; see $RUN/$name.log"
}

running() { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }

# Reverse start order; each component runs in its own process group (setsid), so children stop with it.
stop() {
  local name pid
  for name in ui api gateway; do
    running "$name" || { rm -f "$RUN/$name.pid"; continue; }
    pid=$(cat "$RUN/$name.pid")
    kill -TERM -- "-$pid" 2>/dev/null || true
    for _ in $(seq 40); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
    kill -0 "$pid" 2>/dev/null && kill -KILL -- "-$pid" 2>/dev/null
    rm -f "$RUN/$name.pid"
    echo "stopped $name"
  done
}

status() {
  local name
  for name in "${COMPONENTS[@]}"; do
    if running "$name"; then echo "$name: running (pid $(cat "$RUN/$name.pid"))"; else echo "$name: stopped"; fi
  done
}

main "$@"
