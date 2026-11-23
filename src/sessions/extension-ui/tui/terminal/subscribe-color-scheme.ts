import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "./reject-terminal-operation.ts";

export function onTerminalColorSchemeChange(ctx: UiContext) { return unsupportedTui("terminal color scheme"); }
