import { spawn } from "node:child_process";
import { once } from "node:events";
import { assembleRuntimeSource } from "../../../src/target-channel/deployment-source/assemble-runtime-source.ts";

export function openCollector(pythonPath, args = [], env = {}) {
  const child = spawn(pythonPath, ["-u", "-c", assembleRuntimeSource(), ...args], { stdio: ["pipe", "pipe", "inherit"], env: { ...process.env, ...env } });
  const messages = [];
  const waiters = [];
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    for (let at = buffer.indexOf("\n"); at >= 0; at = buffer.indexOf("\n")) {
      messages.push(JSON.parse(buffer.slice(0, at)));
      buffer = buffer.slice(at + 1);
    }
    for (const waiter of [...waiters]) waiter();
  });
  const exited = once(child, "exit");
  return {
    child,
    exited,
    send: (command) => {
      const mod = command.op === "quit" ? "runtime" : "monitor";
      child.stdin.write(`${JSON.stringify({ id: command.id ?? 0, mod, ...command })}\n`);
    },
    /** First message after `from` matching `match`. */
    async next(match, from = 0, timeoutMs = 10000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const index = messages.findIndex((message, position) => position >= from && match(message));
        if (index >= 0) return { message: messages[index], index };
        if (Date.now() > deadline) throw new Error(`Timed out; saw ${JSON.stringify(messages)}`);
        await new Promise((resolve) => { waiters.push(resolve); setTimeout(resolve, 100); });
      }
    },
    count: () => messages.length,
    since: (from) => messages.slice(from),
  };
}
