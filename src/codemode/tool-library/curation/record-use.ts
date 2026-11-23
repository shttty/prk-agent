import type { ToolLibraryContext } from "../library-state.ts";
import { time } from "./read-time.ts";
import { promote } from "./promote-tool.ts";
import { bound } from "./enforce-capacity.ts";
import { publish } from "../observation/publish-library.ts";
import { age } from "./age-library.ts";
import { latest } from "../catalog/read-latest-tool.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";

export function used(ctx: ToolLibraryContext, name: string, version: number, sessionId: string): void {
  const record = latest(ctx, name);
  if (record.version !== version || record.status === "archived") throw new WireError("NOT_FOUND", "The executed tool version is no longer loaded.");
  if (!record.sessions.includes(sessionId)) record.sessions.push(sessionId);
  record.successfulCalls++;
  record.lastUsedAt = time(ctx);
  age(ctx);
  if (record.status === "staging" && record.sessions.length >= ctx.options.promotion.distinctSessions) {
    record.promotionReady = true;
    promote(ctx, record, false);
  }
  bound(ctx); publish(ctx);
}
