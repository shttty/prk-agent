import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "./reject-terminal-operation.ts";

export function getClearOnShrink(ctx: UiContext) { return unsupportedTui("clear-on-shrink"); }
