import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { soulPath } from "./soul/soul-path.ts";

/** Read on every session (re)creation, so edits apply to new or reloaded sessions without a restart. */
export function readAppendSystemPrompt(file: string, agentDir: string): string[] {
  if (!file) return [];
  const path = soulPath(dirname(agentDir), file);
  let text: string;
  try {
    text = readFileSync(path, "utf8").trim();
  } catch (error) {
    throw new Error(`Cannot read configured session prompt file ${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return text ? [text] : [];
}
