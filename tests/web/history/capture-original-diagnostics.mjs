import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const HISTORY_DIAGNOSTIC_CHILD_ENV = "PI_WEB_HISTORY_DIAGNOSTIC_CHILD";
/**
 * Runs the browser history check as a detached child that owns its process group (its own target fixture, Gateway,
 * daemon and browser), so a hard timeout can stop everything it started without touching anything else.
 */
export async function captureOriginalHistoryDiagnostics(scriptURL) {
  const child = spawn(process.execPath, [fileURLToPath(scriptURL)], {
    cwd: fileURLToPath(new URL("../..", scriptURL)),
    env: { ...process.env, [HISTORY_DIAGNOSTIC_CHILD_ENV]: "1" },
    // detached makes the self-launched browser test the verified owner of its process group.
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-200_000); });
  child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-200_000); });
  const closed = new Promise((resolveClosed, rejectClosed) => {
    child.once("error", rejectClosed);
    child.once("close", (code, signal) => resolveClosed({ code, signal }));
  });
  const signalOwnedGroup = (signal) => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
    try { process.kill(-child.pid, signal); } catch (error) { if (error?.code !== "ESRCH") throw error; }
  };
  let stopping;
  const stop = () => stopping ??= (async () => {
    if (child.exitCode !== null || child.signalCode !== null) { await closed; return; }
    signalOwnedGroup("SIGTERM");
    let stopTimer;
    const stopped = await Promise.race([closed.then(() => true), new Promise((resolveStopped) => { stopTimer = setTimeout(() => resolveStopped(false), 15_000); })]);
    clearTimeout(stopTimer);
    if (!stopped) signalOwnedGroup("SIGKILL");
    await closed;
  })();
  const forwardSignal = () => { void stop(); };
  process.once("SIGTERM", forwardSignal);
  process.once("SIGINT", forwardSignal);
  let timer;
  try {
    const result = await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Timed out running the original browser history process.")), 120_000); })]);
    assert.equal(result.code, 0, `Original browser history process failed (signal=${result.signal}). stdout=${stdout} stderr=${stderr}`);
    process.stdout.write(stdout);
  } finally {
    process.removeListener("SIGTERM", forwardSignal);
    process.removeListener("SIGINT", forwardSignal);
    clearTimeout(timer);
    await stop();
  }
}
