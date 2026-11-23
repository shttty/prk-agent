import { join } from "node:path";

/** Built-in configuration when `localmemory.toml` is absent, in the TOML document's own shape. */
export function defaultLayerDocument(directory: string) {
  return Object.freeze({
    projectsDirectory: join(directory, "projects"),
    review: { enabled: true, userTurns: 10, toolCalls: 15 },
    layers: [
      { name: "control", path: join(directory, "active_control.md"), capacityCharacters: 4000, soft: true, explicitOnly: true, review: true,
        description: "Standing user rules and authorization boundaries; changed only on explicit user instruction." },
      { name: "user", path: join(directory, "user.md"), capacityCharacters: 4000, review: true,
        description: "User identity, enduring preferences and background." },
      { name: "memory", path: join(directory, "notes.md"), capacityCharacters: 4000, review: true,
        description: "General durable facts: environment facts, tool pitfalls, agreements and lessons." },
      { name: "instance", path: join(directory, "instances/{instance}.md"), capacityCharacters: 2000, review: true,
        description: "Facts bound to the machine this session runs on." },
      { name: "project", path: join(directory, "projects/{project}/memory.md"), capacityCharacters: 4000, review: true,
        description: "Durable facts of the session's project; other files in the project directory are its records and documents, read on demand." },
    ],
  });
}