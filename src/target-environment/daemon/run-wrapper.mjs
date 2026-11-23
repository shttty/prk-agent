import { spawn } from "node:child_process";
import { connect } from "node:net";
import { localDaemon } from "@earendil-works/pi-env";
import { bootstrapLogin } from "./bootstrap-login.mjs";
import { writeInput } from "./write-input.mjs";
import { observeMarker } from "./observe-marker.mjs";

const [socketPath, inputText, serve, tokenFlag, token] = process.argv.slice(2);
if (serve !== "serve" || tokenFlag !== "--token" || !/^[a-f0-9]{32}$/.test(token ?? "")) {
  throw new Error("Invalid wrapper invocation");
}
const input = JSON.parse(inputText);
const control = connect(socketPath);
const connected = Promise.withResolvers();
control.once("connect", connected.resolve);
control.once("error", connected.reject);
await connected.promise;
let stage = "connection";
const report = (event) => {
  if (event.kind === "detected") stage = "deployment";
  else if (event.kind === "deployment") stage = "connection";
  if (control.writableLength > 65536) throw new Error("control output exceeds 64 KiB");
  control.write(`${JSON.stringify(event)}\n`);
};
const child = input.local
  ? spawn(localDaemon(), ["serve", "--token", token], { stdio: "pipe", detached: true })
  : spawn("/bin/sh", ["-c", input.command], { stdio: "pipe", detached: true });
let stopping = false;
let tail = "";
let failure;
let failureReason;
let killTimer;
let totalTimer;
let ready = false;
const localReady = input.local
  ? observeMarker(child.stdout, Buffer.from(`PI-ENV ${token}\n`), 8000, "local-token")
  : undefined;
let queued = [];
let queuedBytes = 0;
const stop = (message, reason = stage) => {
  if (stopping) return;
  stopping = true;
  clearTimeout(totalTimer);
  if (message) { failure = message; failureReason = reason; }
  process.stdin.pause();
  child.stdin.destroy();
  try { process.kill(-child.pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  killTimer = setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 1000);
};
control.on("error", () => stop("control connection lost"));
control.on("end", () => stop());
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop());
process.stdin.on("end", () => stop());
process.stdin.on("error", (error) => stop(error.message));
process.stdout.on("error", (error) => stop(error.message));
child.stdin.on("error", (error) => stop(`stdin: ${error.message}`));
child.on("error", (error) => stop(`spawn: ${error.message}`));
child.stderr.on("data", (bytes) => {
  tail = (tail + bytes.toString("utf8")).slice(-8192);
  if (!process.stderr.write(bytes)) child.stderr.pause();
});
process.stderr.on("drain", () => child.stderr.resume());
child.stdout.pipe(process.stdout);
child.on("exit", (code, signal) => {
  if (!ready) report({ kind: "failure", reason: failureReason ?? stage, message: `${failure ?? "startup transport exited"}; code=${code} signal=${signal}\n${tail}` });
  report({ kind: "exit", code, signal });
  stop();
});
child.on("close", (code, signal) => {
  if (failure) report({ kind: "failure", reason: failureReason ?? stage, message: `${failure}; code=${code} signal=${signal}\n${tail}` });
  clearTimeout(killTimer);
  clearTimeout(totalTimer);
  control.end();
  process.exitCode = code ?? (signal ? 1 : 0);
  process.stdin.destroy();
});
process.stdin.on("data", (bytes) => {
  if (!ready) {
    queuedBytes += bytes.length;
    if (queuedBytes > 1024 * 1024) stop("protocol gate exceeds 1 MiB");
    else queued.push(bytes);
  } else if (!child.stdin.write(bytes)) process.stdin.pause();
});
child.stdin.on("drain", () => { if (ready && !stopping) process.stdin.resume(); });
report({ kind: "spawn", wrapperPid: process.pid, loginPid: child.pid, local: input.local });
totalTimer = setTimeout(() => stop("startup: total timeout 50000 ms", "timeout"), 50000);
try {
  if (input.local) {
    // The same marker gate keeps Connection bytes out until the actual daemon starts.
    await localReady;
  } else await bootstrapLogin(child, token, report, input.targetCacheRoot);
  if (!stopping) {
    process.stdin.pause();
    report({ kind: "gate", queuedBytes });
    for (const bytes of queued) await writeInput(child.stdin, bytes);
    queued = [];
    ready = true;
    clearTimeout(totalTimer);
    process.stdin.resume();
  }
} catch (error) {
  stop(error.message, error.code === "ETIMEDOUT" ? "timeout" : stage);
}
