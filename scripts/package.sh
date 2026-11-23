#!/usr/bin/env bash
# Build a source tarball for another Linux machine, bundling the PRK artifact store and the agent's plugins.
# Usage: scripts/package.sh [OUT_DIR] [--skip PLUGIN]...
#   artifacts come from <PRK home>/assets, plugins from <PRK home>/agent/settings.json; --skip leaves a plugin out
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PRK_HOME=${PRK_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}/pi-remote-kernel}
OUT_ARG=${1:-$ROOT/dist}
[ "$#" -eq 0 ] || shift
OUT=$(mkdir -p "$OUT_ARG" && cd "$OUT_ARG" && pwd)
cd "$ROOT"
[ -z "$(git status --porcelain -- . ':!dist')" ] || { echo "package: commit first; the tarball holds HEAD only" >&2; exit 1; }
[ -f "$PRK_HOME/assets/manifest.json" ] && [ -d "$PRK_HOME/assets/store" ] || { echo "package: no artifact store at $PRK_HOME/assets" >&2; exit 1; }
name=prk-$(git rev-parse --short HEAD)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
git archive --prefix="$name/" HEAD | tar -x -C "$stage"
# remote-ext-* artifacts are caches the Gateway publishes for remote plugin hosts; they embed this
# machine's Node binary, so the target builds its own instead of receiving them.
node --input-type=module - "$PRK_HOME/assets" "$stage/$name/assets" <<'EOF'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readPythonRelease } from "./src/artifacts/python/python-release.ts";
const [from, to] = process.argv.slice(2);
readPythonRelease(from);
const manifest = JSON.parse(readFileSync(join(from, "manifest.json"), "utf8"));
manifest.tools = Object.fromEntries(Object.entries(manifest.tools).filter(([name]) => !name.startsWith("remote-ext-")));
mkdirSync(join(to, "store"), { recursive: true });
for (const tool of Object.values(manifest.tools))
  for (const version of Object.values(tool.versions))
    for (const { sha256 } of Object.values(version.platforms)) copyFileSync(join(from, "store", sha256), join(to, "store", sha256));
writeFileSync(join(to, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
EOF
node "$ROOT/scripts/package-plugins.mjs" --agent-dir "$PRK_HOME/agent" --out "$stage/$name/plugins" "$@"
tar -C "$stage" -czf "$OUT/$name.tar.gz" "$name"
echo "$OUT/$name.tar.gz"
