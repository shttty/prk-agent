import type { ToolLibraryContext } from "../library-state.ts";
import type { ToolLibraryAction, ToolLibraryEntry } from "../library-types.ts";
import { transition } from "./transition-tool.ts";
import { promote } from "./promote-tool.ts";
import { bound } from "./enforce-capacity.ts";
import { publish } from "../observation/publish-library.ts";
import { age } from "./age-library.ts";
import { latest } from "../catalog/read-latest-tool.ts";
import { list } from "../catalog/list-tools.ts";

export function change(ctx: ToolLibraryContext, action: ToolLibraryAction, name: string): ToolLibraryEntry[] {
  age(ctx);
  const record = latest(ctx, name);
  if (action === "delete") ctx.records = ctx.records.filter((item) => item.name !== name);
  else if (action === "promote") promote(ctx, record, true);
  else transition(ctx, record, action === "archive" ? "archived" : "staging");
  bound(ctx); publish(ctx);
  return list(ctx);
}
