import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "./reject-terminal-operation.ts";

export function start(ctx: UiContext) { return unsupportedTui("start"); }
