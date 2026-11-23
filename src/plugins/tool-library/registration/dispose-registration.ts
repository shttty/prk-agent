import type { ToolLibraryRegistrationContext } from "../registration-types.ts";

export function unsubscribe(ctx: ToolLibraryRegistrationContext): void { for (const detach of ctx.subscriptions) detach(); }
