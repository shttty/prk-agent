import { readdir, readFile, readlink } from "node:fs/promises";
import { sep } from "node:path";

/**
 * The live Python REPL processes a local target started for working directories under `root`: real `/proc` entries
 * running `<python> -u -c <bootstrap>` (src/kernel/process/start.ts) with their cwd inside `root`, as sorted pids.
 * Fixtures give every test its own root, so this never counts another test's or the user's processes.
 */
export async function listKernelProcesses(python, root) {
  const pids = [];
  for (const pid of await readdir("/proc")) {
    if (!/^\d+$/.test(pid)) continue;
    try {
      const argv = (await readFile(`/proc/${pid}/cmdline`, "utf8")).split("\0");
      if (argv[0] !== python || argv[1] !== "-u" || argv[2] !== "-c") continue;
      const cwd = await readlink(`/proc/${pid}/cwd`);
      if (cwd === root || cwd.startsWith(root + sep)) pids.push(Number(pid));
    } catch (error) {
      if (!["ENOENT", "ESRCH", "EACCES"].includes(error.code)) throw error;
    }
  }
  return pids.sort((left, right) => left - right);
}
