import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("../../web/", import.meta.url));
const viteBin = fileURLToPath(new URL("../../web/node_modules/vite/bin/vite.js", import.meta.url));

/**
 * Start the web/ Vite dev server in front of one backend API listener, as
 * `npm run dev` in web/ does. Browser tests open `url`; the page reaches the
 * backend only through the dev server's /api proxy (PRK_API).
 */
export async function startWebDev(api, { host = "127.0.0.1", port = 0 } = {}) {
  await access(viteBin).catch(() => {
    throw new Error(`web/ dependencies are not installed (${viteBin} is missing); run npm install in web/.`);
  });
  const child = spawn(process.execPath, [viteBin, "--host", host, "--port", String(port), "--strictPort", "--clearScreen", "false"], {
    cwd: webRoot,
    env: { ...process.env, PRK_API: new URL(api).origin, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  const url = await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      if (error) {
        child.kill("SIGKILL");
        reject(new Error(`${error.message} ${output}`.trim()));
      } else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("Timed out starting the web dev server.")), 30_000);
    const onExit = (code, signal) => finish(new Error(`Web dev server exited before readiness (code=${code}, signal=${signal}).`));
    const read = (chunk) => {
      output = `${output}${chunk}`.slice(-20_000);
      // Vite prints loopback binds as "Local:" and private-address binds as "Network:".
      const ready = /(?:Local|Network):\s+(http:\/\/\S+)/.exec(output);
      if (ready) finish(undefined, new URL(ready[1]).origin);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.once("exit", onExit);
    child.once("error", (error) => finish(error));
  });
  let closing;
  const close = () => closing ??= (async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill("SIGTERM");
    let timer;
    const timeout = new Promise((resolve) => { timer = setTimeout(resolve, 10_000, "timeout"); });
    const result = await Promise.race([exited, timeout]);
    clearTimeout(timer);
    if (result === "timeout") {
      child.kill("SIGKILL");
      await exited;
    }
  })();
  return { url, close, get output() { return output; } };
}
