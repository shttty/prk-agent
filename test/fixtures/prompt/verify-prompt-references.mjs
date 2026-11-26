import assert from "node:assert/strict";
import { getCurrentSystemMessage, getCurrentTools, getSystemMessageText } from "@earendil-works/pi-ai";
import { text } from "../gateway/assemble-gateway.mjs";
import { findDanglingReferences } from "./find-dangling-references.mjs";

const NATIVE = ["read", "bash", "edit", "write", "grep", "find", "ls"];
const defs = (block) => [...block.matchAll(/^def (\w+)\(/gm)].map((match) => match[1]);

/**
 * Every tool or kernel helper the model's real prompt and tool descriptions name must be offered this turn:
 * declared in the request, enabled in the session's capability catalog, or a helper of the kernel when kernel_code is declared.
 * The stubs are named too: each `def` of the <kernel> section must be a function the running kernel really defines, and each `def` of the
 * <tool_catalog> section a tool gateway.describe() lists, which is what gateway.<name>(**args) can call.
 */
export async function verifyPromptReferences(f, sessionId, messages) {
  const system = getCurrentSystemMessage(messages);
  const declared = getCurrentTools(messages);
  const catalog = await f.request("nativeAction", { sessionId, requestId: crypto.randomUUID(), action: "capabilities" });
  const tools = catalog.data.entries.filter((entry) => entry.id.startsWith("tool:"));
  const { helpers, callable } = declared.some(({ name }) => name === "kernel_code") ? await kernelNames(f, sessionId) : { helpers: [], callable: [] };
  const known = new Set([...tools.map(({ name }) => name), ...helpers, ...NATIVE]);
  const available = new Set([...declared.map(({ name }) => name), ...tools.filter(({ enabled, loaded }) => enabled && loaded).map(({ name }) => name), ...helpers]);
  // `#` lines inside the catalog's stubs are the tools' own parameter descriptions, like the parameters of a declared tool, which this check does not read either.
  const prose = getSystemMessageText(system).replace(/<tool_catalog>[\s\S]*?<\/tool_catalog>/, (block) => block.replace(/^\s*# .*\n/gm, ""));
  const texts = [["system prompt", prose], ...declared.map((tool) => [`tool ${tool.name}`, tool.description])];
  const dangling = findDanglingReferences(texts, { known, available });
  assert.deepEqual(dangling, [], `the prompt names tools it does not offer: ${JSON.stringify(dangling, null, 1)}`);
  const full = getSystemMessageText(system);
  const kernelBlock = /<kernel>\n[\s\S]*?\n<\/kernel>/.exec(full)?.[0] ?? "";
  const catalogBlock = /<tool_catalog>\n[\s\S]*?\n<\/tool_catalog>/.exec(full)?.[0] ?? "";
  assert.deepEqual(defs(kernelBlock).filter((name) => !helpers.includes(name)), [], "the kernel stubs describe functions the kernel does not define");
  assert.deepEqual(defs(catalogBlock).filter((name) => !callable.includes(name)), [], "the tool catalog stubs describe tools gateway.describe() does not list");
}

async function kernelNames(f, sessionId) {
  const code = "print('HELPERS ' + ' '.join(sorted(n for n, v in globals().items() if callable(v) and not n.startswith('_'))))\nprint('CALLABLE ' + ' '.join(item['name'] for item in gateway.describe()))";
  const receipt = await f.send(sessionId, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code } })}`);
  assert.equal((await f.complete(sessionId, receipt)).status, "completed");
  const result = text(f.state(sessionId).messages.findLast((message) => message.role === "toolResult"));
  const line = (key) => new RegExp(`^${key} (.*)$`, "m").exec(result)?.[1].split(" ") ?? assert.fail(result);
  return { helpers: line("HELPERS"), callable: line("CALLABLE") };
}
