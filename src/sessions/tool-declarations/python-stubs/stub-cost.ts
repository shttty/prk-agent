import type { ToolStub } from "./render-tool-stub.ts";

/** Characters per token when estimating what a stub costs in the prompt (Pi codemode CHARS_PER_TOKEN). */
const CHARS_PER_TOKEN = 4;

/** Estimated tokens of a stub: its TypedDicts and its def. */
export function stubCost(stub: ToolStub): number {
  return Math.ceil([...stub.classes.values(), stub.def].join("\n").length / CHARS_PER_TOKEN);
}
