import { spawn } from "node:child_process";
import { unsupported } from "../sdk-facade/reject-capability.mjs";
import { kill } from "./kill-command.mjs";
import { finish } from "./settle-command.mjs";

export function executeCommand(ctx, owner, command, args, options = {}) {
  ctx.assertLive(owner);
  if (owner.phase === "closing") throw new Error("Remote extension is shutting down");
  if (typeof command !== "string" || !Array.isArray(args) || !args.every((arg) => typeof arg === "string")) throw new TypeError("pi.exec requires command and string arguments");
  for (const key of Object.keys(options)) if (!["signal", "timeout", "cwd"].includes(key)) unsupported(`pi.exec options.${key}`);
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  const operation = new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd ?? owner.snapshot.cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const commandCtx = { child, signal, resolve, stdout: "", stderr: "", killed: false, timeout: undefined, forceKill: undefined, settled: false, kill: undefined, finish: undefined };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (data) => { commandCtx.stdout += data; });
    child.stderr.on("data", (data) => { commandCtx.stderr += data; });
    commandCtx.kill = kill.bind(undefined, commandCtx);
    commandCtx.finish = finish.bind(undefined, commandCtx);
    child.once("error", () => commandCtx.finish(1));
    child.once("close", commandCtx.finish);
    signal.addEventListener("abort", commandCtx.kill, { once: true });
    if (signal.aborted) commandCtx.kill();
    if (options.timeout > 0) commandCtx.timeout = setTimeout(commandCtx.kill, options.timeout);
  });
  owner.commandsInFlight.set(controller, operation);
  return operation.finally(() => owner.commandsInFlight.delete(controller));
}
