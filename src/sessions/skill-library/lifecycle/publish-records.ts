import type { SkillLibraryContext } from "../skill-types.ts";
import { writeFileSync, renameSync } from "node:fs";

export function publish(ctx: SkillLibraryContext): void {
  writeFileSync(ctx.file + ".tmp", JSON.stringify(ctx.records, null, 2) + "\n", { mode: 0o600 });
  renameSync(ctx.file + ".tmp", ctx.file);
}
