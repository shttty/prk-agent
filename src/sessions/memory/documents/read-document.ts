import { readFileSync } from "node:fs";

export function readRaw(path: string): string | undefined {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(path)); }
  catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined; throw error; }
}
