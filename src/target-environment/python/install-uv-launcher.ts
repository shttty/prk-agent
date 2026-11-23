import { posix } from "node:path";
import type { RemoteExecutionEnv } from "@earendil-works/pi-env";
import type { ManagedPythonPaths } from "./managed-paths.ts";
import { runPythonBootstrapCommand } from "./run-python-bootstrap-command.ts";

const launcher = `#!/bin/sh
if [ -z "$UV_INDEX_URL" ]; then
  printf '%s\\n' 'No PyPI mirror configured. Set pythonIndexUrl for this instance or in config.toml.' >&2
  exit 78
fi
unset UV_INDEX UV_EXTRA_INDEX_URL
exec "$PRK_UV_EXECUTABLE" "$@"
`;

export async function installUvLauncher(remote: RemoteExecutionEnv, signal: AbortSignal, paths: ManagedPythonPaths): Promise<void> {
  const result = await runPythonBootstrapCommand(remote, signal, ["/bin/sh", "-ec", `
mkdir -p -- "$1"
file=$(mktemp -- "$1/.uv.XXXXXX")
trap 'rm -f -- "$file"' EXIT
printf %s "$2" > "$file"
chmod 555 -- "$file"
mv -f -- "$file" "$1/uv"
`, "prk-uv-launcher", posix.dirname(paths.uvLauncher), launcher]);
  if (result.exitCode !== 0) throw new Error(`Cannot install the managed uv launcher: ${result.output}`);
}
