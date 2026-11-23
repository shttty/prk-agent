import type { KernelLanguage } from "../../../../kernel/kernel-types.ts";

export function renderGatewayCalls(language: KernelLanguage): string {
  if (language === "bun") return "Gateway callbacks: await gateway.call(name, args) or await gateway.<tool>(args). Await gateway.describe() for callable names or gateway.describe(name) for the schema. Results are structured values or literal text; failures throw. Python library and hashline helpers are not available in Bun.";
  return "Gateway callbacks: callable tools are available as gateway.<tool_name>(**args), equivalent to gateway.call(tool_name,args). gateway.describe() lists callable tools; gateway.describe(name) returns its parameters schema. Check the schema before calling an unfamiliar tool. All gateway calls and kernel-module host.call results are native Python dict/list/str/int/float/bool/None; do not use json.loads on PRK results. PRK structured data uses outputSchema/structuredContent. Plugins return structuredContent when provided, otherwise literal text str without JSON guessing. Failures raise Python exceptions.";
}
