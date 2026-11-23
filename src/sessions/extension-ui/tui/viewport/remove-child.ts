import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "../terminal/reject-terminal-operation.ts";

export function removeChild(ctx: UiContext) { return unsupportedTui("removeChild"); }
