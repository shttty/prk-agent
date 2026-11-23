import type { Extension } from "@earendil-works/pi-coding-agent";

export function commands(extension: Extension, projection: Extension): Extension["commands"] {
  return new Map([...extension.commands].map(([name, command]) => [name, { ...command, sourceInfo: projection.sourceInfo }]));
}
