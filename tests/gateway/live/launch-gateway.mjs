import { spawn } from "node:child_process";

export function launch(entry, root, args, env) {
  const child = spawn(process.execPath, [entry, ...args], { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => { stdout = (stdout + chunk).slice(-2_000_000); });
  // Never echo provider diagnostics, prompts, private target paths or credentials.
  child.stderr.resume();
  const done = new Promise((resolve, reject) => {
    child.once("exit", (code) => resolve(code)); child.once("error", reject);
  });
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
    try { await done; } finally { clearTimeout(timer); }
  };
  return { child, done, stop, get stdout() { return stdout; } };
}
