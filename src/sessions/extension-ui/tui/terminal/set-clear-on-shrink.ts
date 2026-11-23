import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "./reject-terminal-operation.ts";

export function setClearOnShrink(ctx: UiContext) { return unsupportedTui("clear-on-shrink"); }
