import assert from "node:assert/strict";
import { getCurrentSystemMessage, getCurrentTools, getSystemMessageText } from "@earendil-works/pi-ai";
import { text } from "../gateway/assemble-gateway.mjs";
import { findDanglingReferences } from "./find-dangling-references.mjs";

const NATIVE = ["read", "bash", "edit", "write", "grep", "find", "ls"];

/**
 * Every tool or kernel helper the model's real prompt and tool descriptions name must be offered this turn:
 * declared in the request, enabled in the session's capability catalog, or a helper of the kernel when kernel_code is declared.
 */
export async function verifyPromptReferences(f, sessionId, messages) {
  const system = getCurrentSystemMessage(messages);
  const declared = getCurrentTools(messages);
  const catalog = await f.request("nativeAction", { sessionId, requestId: crypto.randomUUID(), action: "capabilities" });
  const tools = catalog.data.entries.filter((entry) => entry.id.startsWith("tool:"));
  const helpers = declared.some(({ name }) => name === "kernel_code") ? await kernelHelpers(f, sessionId) : [];
  const known = new Set([...tools.map(({ name }) => name), ...helpers, ...NATIVE]);
  const available = new Set([...declared.map(({ name }) => name), ...tools.filter(({ enabled, loaded }) => enabled && loaded).map(({ name }) => name), ...helpers]);
  const texts = [["system prompt", getSystemMessageText(system)], ...declared.map((tool) => [`tool ${tool.name}`, tool.description])];
  const dangling = findDanglingReferences(texts, { known, available });
  assert.deepEqual(dangling, [], `the prompt names tools it does not offer: ${JSON.stringify(dangling, null, 1)}`);
}

async function kernelHelpers(f, sessionId) {
  const code = "print('HELPERS ' + ' '.join(sorted(n for n, v in globals().items() if callable(v) and not n.startswith('_'))))";
  const receipt = await f.send(sessionId, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code } })}`);
  assert.equal((await f.complete(sessionId, receipt)).status, "completed");
  const result = text(f.state(sessionId).messages.findLast((message) => message.role === "toolResult"));
  return /^HELPERS (.*)$/m.exec(result)?.[1].split(" ") ?? assert.fail(result);
}
