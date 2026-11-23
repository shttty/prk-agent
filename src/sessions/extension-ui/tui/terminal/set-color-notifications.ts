import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "./reject-terminal-operation.ts";

export function setTerminalColorSchemeNotifications(ctx: UiContext) { return unsupportedTui("terminal color scheme"); }
