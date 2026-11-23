import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "./reject-terminal-operation.ts";

export function stop(ctx: UiContext) { return unsupportedTui("stop"); }
