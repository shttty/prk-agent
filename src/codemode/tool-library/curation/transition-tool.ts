import type { ToolLibraryContext } from "../library-state.ts";
import type { StoredTool } from "../library-types.ts";
import { time } from "./read-time.ts";

export function transition(ctx: ToolLibraryContext, record: StoredTool, status: StoredTool["status"], manual = false): void {
  record.status = status; record.manual = manual; record.promotionReady = false; record.changedAt = time(ctx);
}
