import { spawn } from "node:child_process";

export function launchLiveProcess(entry, cwd, args, env) {
  const child = spawn(process.execPath, [entry, ...args], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => { stdout = (stdout + chunk).slice(-2_000_000); });
  child.stderr.resume(); // Never echo provider diagnostics or credentials.
  const done = new Promise((resolve, reject) => {
    child.once("exit", resolve); child.once("error", reject);
  });
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
    try { await done; } finally { clearTimeout(timer); }
  };
  return { child, done, stop, get stdout() { return stdout; } };
}
