import { spawnSync } from "node:child_process";
import { availableParallelism } from "node:os";

const result = spawnSync(process.execPath, [
  "--test", `--test-concurrency=${availableParallelism()}`, ...process.argv.slice(2),
], { cwd: new URL("../tests/unit/", import.meta.url), stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
