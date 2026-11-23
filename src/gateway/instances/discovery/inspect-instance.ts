import type { HostContext } from "../../host/host-state.ts";
import type { TargetConnection, InspectTargetResult } from "../instance-types.ts";
import { discoveryConnection } from "../resolve-discovery-connection.ts";
import { createTargetEnvironments } from "../../../target-environment/connection/assemble-environments.ts";
import { executeProbe } from "./execute-probe.ts";
import { WireError } from "../../wire/create-error.ts";

export async function inspectTarget(ctx: HostContext, { connection }: { connection: TargetConnection }): Promise<InspectTargetResult> {
  const input = discoveryConnection(connection, ctx.host.config.limits);
  const environments = createTargetEnvironments({ resolve: () => input, targetCacheRoot: ctx.host.config.targetCacheRoot });
  const lease = await environments.acquire("draft");
  const timeout = ctx.host.config.targetConnection.requestTimeoutMs;
  let failure: WireError | undefined;
  let retirement: Promise<void> | undefined;
  const timer = setTimeout(() => {
    failure = new WireError("TARGET_UNREACHABLE", "Target inspection timed out.", { reason: "timeout", stage: "inspection" });
    retirement = lease.retire(failure);
    void retirement.catch(() => undefined);
  }, timeout);
  try {
    if (connection.cwd !== undefined) {
      const opened = await lease.connection.request("opendir", { path: connection.cwd }, { signal: lease.signal });
      await lease.connection.request("close", { handle: opened.json.handle }, { session: opened.session });
    }
    const output = await executeProbe(lease, ["/bin/sh", "-c", 'hostname; command -v python3 || :; for p in "$HOME/.venv/bin/python" "$HOME/venv/bin/python" "$1/.venv/bin/python"; do if test -x "$p"; then printf "%s\\n" "$p"; fi; done', "prk-inspect", connection.cwd ?? "/"], timeout);
    const [hostname = "", ...candidates] = output.split("\n");
    let python: InspectTargetResult["python"];
    if (connection.python !== undefined) {
      const version = await executeProbe(lease, [connection.python, "-I", "-c", "import sys; print('.'.join(map(str, sys.version_info[:3])))"], timeout);
      const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
      if (!match || Number(match[1]) < 3 || (Number(match[1]) === 3 && Number(match[2]) < 9)) {
        throw new WireError("INVALID_REQUEST", "Python 3.9 or newer is required.", { reason: "python-version", version });
      }
      python = { path: connection.python, version };
    }
    if (failure) throw failure;
    return { hostname, platform: lease.info.os, home: lease.info.home,
      pythonCandidates: [...new Set(candidates.filter((path) => path.startsWith("/")))], ...(python ? { python } : {}) };
  } catch (error) {
    throw failure ?? error;
  } finally {
    clearTimeout(timer);
    try { await retirement; } finally { await lease.release(); }
  }
}
