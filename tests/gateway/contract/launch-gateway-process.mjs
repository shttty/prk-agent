import { spawn } from "node:child_process";

export function launch(entry, root, args, env) {
  const child = spawn(process.execPath, [entry, ...args], { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout = (stdout + chunk).slice(-2_000_000); });
  child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-100_000); });
  const done = new Promise((resolve, reject) => { child.once("exit", (code) => resolve(code)); child.once("error", reject); });
  return { child, done, get stdout() { return stdout; }, get stderr() { return stderr; } };
}
