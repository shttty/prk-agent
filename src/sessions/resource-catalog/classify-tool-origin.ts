import type { ToolInfo } from "@earendil-works/pi-coding-agent";
import { LOCAL_TOOLS_GROUP } from "./catalog-constants.ts";
import type { Origin } from "./catalog-types.ts";
import { packageName } from "./origins/read-resource-package-name.ts";

export function toolOrigin(tool: Pick<ToolInfo, "name" | "sourceInfo" | "namespace">, nativeNames: ReadonlySet<string>): Origin {
  const source = tool.sourceInfo.path.replace(/^<inline:(.+)>$/u, "$1");
  if (nativeNames.has(tool.name)) return { group: LOCAL_TOOLS_GROUP, groupLabel: "本机工具", source };
  if (tool.name.startsWith("prk_saved_")) return { group: "group:tools:library", groupLabel: "沉淀工具", source };
  if (tool.namespace?.name.startsWith("mcp__")) {
    const name = tool.namespace.aliases?.[0] ?? tool.namespace.name.slice(5);
    return { group: `group:tools:mcp:${name}`, groupLabel: name, source };
  }
  const name = tool.sourceInfo.origin === "package" ? packageName(tool.sourceInfo) : tool.sourceInfo.path;
  const label = name.replace(/^<inline:(.+)>$/u, "$1");
  return { group: `group:tools:package:${name}`, groupLabel: label, source };
}
