import { appendFileSync } from "node:fs";

// Placeholders are filled by write-load-probe.mjs, which copies this file into a package of its own.
const NAME = "__NAME__";
const MARKERS = "__MARKERS__";
const mark = (kind) => appendFileSync(MARKERS, `${kind}\n`);

export default function (pi) {
  pi.on("before_agent_start", () => { mark("before_agent_start"); });
  pi.on("agent_settled", () => { mark("agent_settled"); });
  pi.registerTool({
    name: `${NAME}_tool`, label: "Probe", description: "Appends a marker.", parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute() { mark("tool"); return { content: [{ type: "text", text: "probe ran" }], details: {} }; },
  });
  pi.registerCommand(`${NAME}-command`, { description: "Appends a marker.", handler: async () => { mark("command"); } });
}
