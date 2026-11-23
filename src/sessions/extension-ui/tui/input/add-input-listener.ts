import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "../terminal/reject-terminal-operation.ts";

export function addInputListener(ctx: UiContext) { return unsupportedTui("raw input listeners"); }
