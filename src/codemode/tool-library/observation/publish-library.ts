import type { ToolLibraryContext } from "../library-state.ts";
import { renameSync, writeFileSync } from "node:fs";

export function publish(ctx: ToolLibraryContext): void {
  const temporary = ctx.file + ".tmp";
  writeFileSync(temporary, JSON.stringify(ctx.records, null, 2) + "\n", { mode: 0o600 });
  renameSync(temporary, ctx.file);
  for (const listener of ctx.listeners) listener();
}
