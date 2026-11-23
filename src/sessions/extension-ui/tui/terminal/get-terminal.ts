import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "./reject-terminal-operation.ts";

export function getTerminal(ctx: UiContext): never { return unsupportedTui("terminal output"); }
