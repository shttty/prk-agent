import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeLazyProbe({ agentDir, outputA, outputB, partialA, releasePath, smallOutput }) {
    await writeFile(join(agentDir, "extensions/lazy-probe.js"), `
import { access } from "node:fs/promises";
import { Text } from ${JSON.stringify(import.meta.resolve("@earendil-works/pi-tui"))};
const a = ${JSON.stringify(outputA)}, b = ${JSON.stringify(outputB)}, partial = ${JSON.stringify(partialA)};
const result = (text) => ({ content: [{ type: "text", text }], details: { marker: "LAZY_DETAIL_FULL_TAIL", payload: "d".repeat(10000) } });
export default function(pi) {
  const base = (name, execute, extra = {}) => ({ name, label: name, description: name, parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] }, execute, ...extra });
  pi.registerTool(base("lazy_inner", async () => ({ content: [{ type: "text", text: "inner ok" }] })));
  pi.registerTool(base("lazy_large", async (_id, _args, signal, update, ctx) => {
    await ctx.executeTool("lazy_inner", { code: "inner" });
    await ctx.executeTool("lazy_inner", { code: "inner again" });
    update(result(partial));
    const deadline = Date.now() + 30000;
    for (;;) {
      if (signal?.aborted) throw new Error("fixture aborted");
      try { await access(${JSON.stringify(releasePath)}); break; } catch (error) { if (error.code !== "ENOENT") throw error; }
      if (Date.now() > deadline) throw new Error("fixture release timed out");
      await new Promise((done) => setTimeout(done, 20));
    }
    return result(a);
  }));
  pi.registerTool(base("lazy_render", async () => result(b), {
    renderCall(args) { return new Text(args.code, 0, 0); },
    renderResult(value) { return new Text(value.content.map((part) => part.text || "").join("\\n"), 0, 0); },
  }));
  pi.registerTool(base("lazy_small", async () => ({ content: [{ type: "text", text: ${JSON.stringify(smallOutput)} }], details: { intact: true } })));
}`);
}
