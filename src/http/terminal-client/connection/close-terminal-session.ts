import type { TerminalSessionContext } from "../terminal-session-state.ts";
import { releaseTerminal } from "./release.ts";

export function closeTerminalSession(ctx: TerminalSessionContext): void { ctx.stopEvents!(); ctx.stopLifecycle!(); releaseTerminal(ctx, "Terminal observation stopped by the web client."); }
