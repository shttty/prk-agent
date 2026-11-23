import { mkdirSync, readFileSync } from "node:fs";
import { Type } from "typebox";
import { Value } from "typebox/value";
import type { SkillLibraryContext } from "../skill-types.ts";
import { storedSchema } from "../tools/skill-schema.ts";
import { age } from "./age-records.ts";

export function initializeLibrary(ctx: SkillLibraryContext): void {
  mkdirSync(ctx.directory, { recursive: true, mode: 0o700 });
  try {
    const data: unknown = JSON.parse(readFileSync(ctx.file, "utf8"));
    if (!Value.Check(Type.Array(storedSchema), data)) throw new Error("Invalid skill library document.");
    ctx.records = data;
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
  age(ctx);
}
