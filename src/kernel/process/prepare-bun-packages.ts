import { readFileSync } from "node:fs";
import type { BunPackagePins } from "../../config/execution-target/validation/bun-package-options.ts";
import type { TargetEnvironmentLease } from "../../target-environment/connection/connection-types.ts";
import type { KernelConfiguration } from "../kernel-types.ts";
import { bunPackageRoot } from "./bun-package-root.ts";
import { resolveBun } from "./resolve-bun.ts";

export async function prepareBunPackages(config: Pick<KernelConfiguration, "target" | "cwd" | "bun">, environment: TargetEnvironmentLease,
  pins: BunPackagePins, signal: AbortSignal): Promise<void> {
  const bun = config.bun;
  if (!bun?.packages) throw new Error("Bun package maintenance requires an instance registry.");
  const executable = await resolveBun(bun, signal);
  const { registry, scopes } = bun.packages;
  const argv = [executable, "--config=/dev/null", "--no-install", "--no-env-file", "-e",
    readFileSync(new URL("../bun-runner/maintain-packages.mjs", import.meta.url), "utf8"), "--",
    JSON.stringify({ root: bunPackageRoot(config.target, executable, bun.packages), registry, scopes, pins })];
  const reply = await environment.connection.request("exec", { argv, cwd: config.cwd, timeoutMs: 120000 }, { signal });
  const code = reply.json.exitCode;
  if (code !== 0) throw new Error(`Bun package ${code === 3 ? "verification" : "installation"} failed on target.`);
}
