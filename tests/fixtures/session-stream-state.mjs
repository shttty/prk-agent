// Public Pi extension/provider fixture; Gateway, SDK sessions and target REPL remain real.
import { appendFileSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fauxProvider, fauxAssistantMessage, fauxText, fauxToolCall } from "@earendil-works/pi-ai";

export default function register(pi) {
  const provider = fauxProvider({ provider: "session-stream-check", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
  provider.setResponses(Array.from({ length: 100 }, () => (context) => {
    const last = context.messages.at(-1);
    if (last.role === "toolResult") return fauxAssistantMessage("STREAM_TOOL_COMPLETED");
    const text = typeof last.content === "string" ? last.content : last.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    const request = JSON.parse(text);
    return fauxAssistantMessage([fauxText(request.stream), fauxToolCall("kernel_code", { code: request.code })], { stopReason: "toolUse" });
  }));
  pi.registerProvider(provider.provider);
}

export function registerStreamUi(pi) {
  pi.on("session_start", (_event, ctx) => {
    if (!ctx.sessionManager.getSessionFile()) return;
    const stage = JSON.parse(readFileSync(process.env.PRK_STREAM_STAGE_FILE, "utf8"));
    const status = `${stage.name}:${process.pid}:${randomUUID()}`;
    for (let i = 0; i < stage.bump; i++) ctx.ui.setStatus("stream-proof", status);
    void ctx.ui.confirm("STREAM_CONFIRM", status).then((value) => appendFileSync(process.env.PRK_STREAM_ANSWER_FILE, JSON.stringify({ status, pid: process.pid, value }) + "\n"));
  });
  pi.registerCommand("stream-status", { description: "Update real extension UI for transport ordering acceptance", handler(argument, ctx) { ctx.ui.setStatus("stream-proof", argument); } });
}
