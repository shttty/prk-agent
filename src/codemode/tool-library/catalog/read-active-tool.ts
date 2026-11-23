import type { ToolLibraryContext } from "../library-state.ts";
import type { ToolLibraryEntry } from "../library-types.ts";
import { list } from "./list-tools.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";

export function active(ctx: ToolLibraryContext, name: string): ToolLibraryEntry {
  const record = list(ctx).find((item) => item.name === name && item.status !== "archived");
  if (!record) throw new WireError("NOT_FOUND", `Library tool ${JSON.stringify(name)} is unknown or archived.`);
  return record;
}
