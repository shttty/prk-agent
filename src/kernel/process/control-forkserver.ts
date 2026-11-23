import { readFileSync } from "node:fs";
import type { KernelContext, KernelProcess } from "../kernel-state.ts";
import { waitBeforeAbort } from "./wait-before-abort.ts";

type Control = { kind: "cancel"; cellId: string } | { kind: "retire" };
type Status = "pending" | "reaped" | "finished" | "unconfirmed";

export async function controlForkserver(ctx: KernelContext, process: KernelProcess, command: Control,
  timeoutMs: number, signal: AbortSignal): Promise<Status> {
  const { generation } = process;
  const source = readFileSync(new URL("./control-forkserver.py", import.meta.url), "utf8");
  const args = command.kind === "cancel" ? [command.cellId] : [];
  const output = Buffer.alloc(4096);
  let size = 0, invalid = false;
  const reply = await waitBeforeAbort(process.lease.connection.request("exec", {
    cwd: ctx.configuration.cwd, timeoutMs,
    argv: [ctx.configuration.python, "-I", "-c", source, String(timeoutMs / 1000), command.kind, generation, ...args],
  }, { signal, onEvent(event, bytes) {
    if (event.kind !== "output" || event.stream !== "stdout") return;
    if (event.skipped !== undefined || size + bytes.byteLength > output.length) invalid = true;
    else if (!invalid) { output.set(bytes, size); size += bytes.byteLength; }
  } }), signal);
  if (invalid || reply.json.exitCode !== 0) throw new Error("No forkserver cleanup receipt.");
  const response = JSON.parse(output.toString("utf8", 0, size));
  if (!response || Object.keys(response).length !== (command.kind === "cancel" ? 3 : 2)
    || response.generation !== generation || response.cellId !== args[0]
    || !["pending", "reaped", "finished", "unconfirmed"].includes(response.status)
    || (command.kind === "retire" && response.status !== "reaped" && response.status !== "unconfirmed")) {
    throw new Error("Invalid forkserver cleanup receipt.");
  }
  return response.status;
}
