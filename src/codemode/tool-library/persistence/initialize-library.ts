import { mkdirSync, readFileSync } from "node:fs";
import { Type } from "typebox";
import { Value } from "typebox/value";
import type { ToolLibraryContext } from "../library-state.ts";
import { storedSchema } from "../library-schema.ts";
import { age } from "../curation/age-library.ts";

export function initializeLibrary(ctx: ToolLibraryContext): void {
  mkdirSync(ctx.directory, { recursive: true, mode: 0o700 });
  try {
    const data: unknown = JSON.parse(readFileSync(ctx.file, "utf8"));
    if (!Value.Check(Type.Array(storedSchema), data)) throw new Error("Invalid tool library document.");
    ctx.records = data;
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
  age(ctx);
}
