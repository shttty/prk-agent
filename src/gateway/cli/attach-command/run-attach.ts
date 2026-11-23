import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { connectGateway } from "../../socket-client/connect-client.ts";
import { WireError } from "../../wire/create-error.ts";
import type { Method } from "../../wire/wire-types.ts";
import { loadPrkConfig } from "../../../config/document/load-prk-config.ts";
import { resolvePrkHome } from "../../../config/home/resolve-prk-home.ts";
import type { AttachCommandContext } from "../command-state.ts";
import { output as outputValue } from "./output.ts";
import { stop as stopAttach } from "./stop.ts";

export async function attach(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    home: { type: "string" }, socket: { type: "string" }, message: { type: "string" },
    "request-id": { type: "string" }, queue: { type: "string" },
    "operation-id": { type: "string" }, "session": { type: "string" }, "target": { type: "string" },
    label: { type: "string" }, cwd: { type: "string" },
  } });
  if (positionals.length > 1) throw new WireError("CLI_ERROR","Attach accepts at most one action.");
  const action = positionals[0];
  const allowed = ["workbench", "create", "reload-targets", "state", "messages", "watch", "watch-sessions", "send", "cancel", "reload", "close-session", "shutdown"];
  if (action && !allowed.includes(action)) throw new WireError("CLI_ERROR","Unsupported attach action.");
  const sessionScoped = ["state", "messages", "watch", "send", "cancel", "reload", "close-session"];
  const needsSession = action === undefined || sessionScoped.includes(action);
  if (needsSession && !values.session) throw new WireError("CLI_ERROR","This action requires --session ID from attach workbench or attach create.");
  if (action === "create" && !values.target) throw new WireError("CLI_ERROR","create requires --target INSTANCE_ID.");
  for (const [key, permitted] of [
    ["message", action === "send"], ["request-id", action === "send"], ["queue", action === "send"],
    ["operation-id", action === "cancel"], ["target", action === "create"],
    ["label", action === "create"], ["cwd", action === "create"], ["session", needsSession],
  ] as const) {
    if (values[key] !== undefined && !permitted) throw new WireError("CLI_ERROR",`--${key} is not valid for this action.`);
  }
  const sessionId = values.session as string;
  const params = action === "send" ? { sessionId, requestId: values["request-id"] ?? randomUUID(), message: values.message,
    ...(values.queue ? { queue: values.queue } : {}) }
    : action === "cancel" ? { sessionId, operationId: values["operation-id"] }
    : action === "create" ? {
      target: values.target,
      ...(values.label === undefined ? {} : { label: values.label }),
      ...(values.cwd === undefined ? {} : { cwd: values.cwd }),
    }
    : needsSession ? { sessionId } : {};
  const config = await loadPrkConfig(resolvePrkHome(values.home));
  const output = (value: unknown) => outputValue(ctx, value);
  const client = await connectGateway(values.socket ?? config.gateway.socketPath, config.gateway, config.limits);
  const ctx: AttachCommandContext = { client, config };
  const stop = () => stopAttach(ctx);
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  process.stdout.on("error", stop);
  try {
    if (action === "watch-sessions") {
      client.onCollectionEvent((event) => output({ collection: event }));
      output({ workbench: await client.request("subscribeSessions") });
      await client.closed; return;
    }
    if (action && action !== "watch") {
      const method = action === "create" ? "createSession" : action === "close-session" ? "closeSession" : action === "reload-targets" ? "reloadTargets" : action as Method;
      output(await client.request(method, params as Record<string, unknown>)); return;
    }
    client.onEvent((event, source) => output({ sessionId: source, event }));
    output({ snapshot: await client.request("subscribe", { sessionId }) });
    if (action === "watch") { await client.closed; return; }
    const input = createInterface({ input: process.stdin, terminal: false });
    void client.closed.then(() => input.close());
    try {
      for await (const line of input) {
        if (!line.trim()) continue;
        if (line === "/quit") break;
        try {
          const [cmd, ...parts] = line.split(" ");
          const parameter = parts.join(" ");
          if (cmd === "/cancel") output(await client.request("cancel", { sessionId, operationId: parameter }));
          else if (cmd === "/close-session" && !parameter) output(await client.request("closeSession", { sessionId }));
          else if (cmd === "/reload-targets" && !parameter) output(await client.request("reloadTargets", {}));
          else if (["/state", "/messages", "/reload"].includes(cmd!) && !parameter) output(await client.request(cmd!.slice(1) as Method, { sessionId }));
          else if (["/workbench", "/shutdown"].includes(cmd!) && !parameter) output(await client.request(cmd!.slice(1) as Method));
          else if (line.startsWith("/")) throw new WireError("CLI_ERROR","Unknown client command; use one-shot send for SDK slash commands.");
          else output(await client.request("send", { sessionId, requestId: randomUUID(), message: line }));
        } catch (error) { console.error(error instanceof Error ? error.message : "Client request failed."); }
      }
    } finally { input.close(); }
  } finally {
    client.disconnect(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
    process.stdout.removeListener("error", stop);
  }
}
