import type { UiContext } from "../../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";

export function onTerminalInput(ctx: UiContext, handler: Parameters<ExtensionUIContext["onTerminalInput"]>[0]) { ctx.terminalInputHandlers.add(handler); return () => ctx.terminalInputHandlers.delete(handler); }
