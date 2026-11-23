import { constants } from "node:fs";
import { access, mkdtemp, rm } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";
import { createTargetEnvironments } from "../../src/target-environment/connection/assemble-environments.ts";
import { parseProcessWindowLimits } from "../../src/target-environment/process-window/parse-limits.ts";
import { DEFAULT_KERNEL_OPTIONS } from "../../src/config/kernel/kernel-options.ts";

/** Owned local daemon fixture. config is an instance fragment; runtime is a PythonToolConfig. */
export async function withTargetFixture(callback, options = {}) {
  const python = process.env.PI_TEST_PYTHON;
  if (!python || !isAbsolute(python)) throw new Error("PI_TEST_PYTHON must name an absolute Python >=3.9 executable");
  await access(python, constants.X_OK);
  const tempRoot = await mkdtemp(join(options.tempParent ?? tmpdir(), "prk-target-"));
  const controller = new AbortController();
  const cleanups = [];
  const environments = createTargetEnvironments({ resolve: () => options.sshCommand === undefined ? { local: true } : { local: false, command: options.sshCommand } });
  const leases = new Set();
  const config = { local: options.sshCommand === undefined, ...(options.sshCommand === undefined ? {} : { sshCommand: options.sshCommand }), python, cwd: tempRoot };
  const runtime = {
    target: "fixture", python, cwd: tempRoot, scoped: true,
    memoryMax: DEFAULT_KERNEL_OPTIONS.memoryMax, memorySwapMax: DEFAULT_KERNEL_OPTIONS.memorySwapMax,
    processWindow: parseProcessWindowLimits(),
    acquire: async () => {
      const lease = await environments.acquire("fixture");
      leases.add(lease);
      return lease;
    },
  };
  const failures = [];
  let result;
  try {
    result = await callback({ config, runtime, tempRoot, owned: true, signal: controller.signal,
      onCleanup: (cleanup) => cleanups.push(cleanup) });
  } catch (error) {
    failures.push(error);
  } finally {
    controller.abort();
    for (const cleanup of cleanups.reverse()) {
      try { await cleanup(); } catch (error) { failures.push(error); }
    }
    for (const lease of leases) {
      try { await lease.release(); } catch (error) { failures.push(error); }
    }
    if (failures.length === 0) {
      try { await rm(tempRoot, { recursive: true, force: true }); } catch (error) { failures.push(error); }
    }
  }
  if (failures.length) throw new AggregateError(failures, `Target fixture failed; evidence retained at ${tempRoot}`);
  return result;
}
