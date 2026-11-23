import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function prepareCodemodePackages(home, agentDir) {
    const callbackPackage = join(home, "callback-package");
    const otherPackage = join(home, "other-package");
    const extensionDirectory = join(callbackPackage, "extensions");
    await mkdir(extensionDirectory, { recursive: true });
    await mkdir(otherPackage);
    await writeFile(join(callbackPackage, "package.json"), JSON.stringify({ name: "prk-callback-fixture", type: "module", pi: { extensions: ["extensions/gateway-callback.js"] } }));
    await writeFile(join(otherPackage, "package.json"), JSON.stringify({ name: "prk-other-fixture", type: "module", pi: { extensions: ["index.js"] } }));
    await writeFile(join(otherPackage, "index.js"), `export default function(pi) {
      pi.registerTool({ name: "extension_other", label: "Other", description: "Other package callback", parameters: { type: "object", properties: {} }, execute: async () => ({ content: [{ type: "text", text: "other-result" }], details: undefined }) });
      pi.registerTool({ name: "web_search", label: "Web search", description: "Plugin web search stand-in", parameters: { type: "object", properties: {} }, execute: async () => ({ content: [{ type: "text", text: "search-result" }], details: undefined }) });
    }`);
    const todoPackage = process.env.PI_TEST_TODO_PACKAGE;
    await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [callbackPackage, otherPackage, ...(todoPackage ? [todoPackage] : [])].map((source) => ({ source, enabled: true, location: "gateway" })) }));
    await writeFile(join(extensionDirectory, "gateway-callback.js"), `export default function(pi) {
      pi.registerTool({ name: "extension_value", label: "Extension value", description: "Code-only structured callback", exposure: "codemode", parameters: { type: "object", properties: { value: { type: "number" } }, required: ["value"] }, outputSchema: { type: "object", properties: { answer: { type: "number" } }, required: ["answer"] }, execute: async (_id, args) => ({ content: [{ type: "text", text: "structured value" }], structuredContent: { answer: args.value + 17 }, details: undefined }) });
      pi.registerTool({ name: "extension_failure", label: "Extension failure", description: "Code-only failing callback", exposure: "codemode", parameters: { type: "object", properties: {} }, execute: async () => { throw new Error("extension callback failure"); } });
      for (const [name, exposure] of [["extension_default", undefined], ["extension_direct", "direct"], ["extension_model_only", "model-only"], ["extension_hidden", "hidden"], ["extension_deferred", "deferred"]]) {
        pi.registerTool({ name, label: name, description: "Native exposure callback", ...(exposure ? { exposure } : {}), parameters: { type: "object", properties: {} }, execute: async () => ({ content: [{ type: "text", text: name + "-result" }], details: undefined }) });
      }
    }`);
  return { callbackPackage, otherPackage, todoPackage };
}
