import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "./reject-terminal-operation.ts";

export function renderTerminal(ctx: UiContext) { return unsupportedTui("terminal rendering"); }
