import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "../terminal/reject-terminal-operation.ts";

export function addChild(ctx: UiContext) { return unsupportedTui("addChild"); }
