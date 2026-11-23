import { spawn } from "node:child_process";

export function launchProcess(ctx, args, env, cwd = ctx.projectRoot) {
  const child = spawn(process.execPath, [ctx.entry, ...args], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  let stdout = "";
  const handle = {
    child,
    done: new Promise((resolvePromise, reject) => {
      child.once("exit", (code, signal) => {
        handle.exitedAt = new Date().toISOString();
        resolvePromise({ code, signal });
      });
      child.once("error", reject);
    }),
    get stderr() { return stderr; },
    get stdout() { return stdout; },
    exitedAt: undefined,
  };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-100_000); });
  child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-100_000); });
  return handle;
}
