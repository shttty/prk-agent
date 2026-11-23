import { spawn } from "node:child_process";

export async function runOwnedShell(command, script) {
  const child = spawn("/bin/sh", ["-c", command], { stdio: "pipe", detached: true });
  const done = Promise.withResolvers();
  let stdout = "";
  let stderr = "";
  const timer = setTimeout(() => {
    try { process.kill(-child.pid, "SIGKILL"); } catch {}
    done.reject(new Error("Owned observer timed out"));
  }, 10000);
  child.stdout.on("data", (bytes) => {
    stdout += bytes;
    if (stdout.length > 1024 * 1024) {
      try { process.kill(-child.pid, "SIGKILL"); } catch {}
      done.reject(new Error("Observer output exceeds 1 MiB"));
    }
  });
  child.stderr.on("data", (bytes) => { stderr = (stderr + bytes).slice(-8192); });
  child.on("error", done.reject);
  child.stdin.on("error", () => {});
  child.on("close", (code) => code === 0 ? done.resolve(stdout) : done.reject(new Error(`Observer exit=${code}: ${stderr}`)));
  child.stdin.end(script);
  try { return await done.promise; }
  finally { clearTimeout(timer); }
}
