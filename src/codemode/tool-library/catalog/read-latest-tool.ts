import type { ToolLibraryContext } from "../library-state.ts";
import type { StoredTool } from "../library-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";

export function latest(ctx: ToolLibraryContext, name: string): StoredTool {
  const record = ctx.records.filter((item) => item.name === name).sort((a, b) => b.version - a.version)[0];
  if (!record) throw new WireError("NOT_FOUND", `Unknown library tool ${JSON.stringify(name)}.`);
  return record;
}
