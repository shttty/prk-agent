import type { Extension } from "@earendil-works/pi-coding-agent";

export function tools(extension: Extension, projection: Extension): Extension["tools"] {
  return new Map([...extension.tools].map(([name, tool]) => [name, { ...tool, sourceInfo: projection.sourceInfo }]));
}
