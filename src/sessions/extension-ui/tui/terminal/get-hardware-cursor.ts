import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "./reject-terminal-operation.ts";

export function getShowHardwareCursor(ctx: UiContext) { return unsupportedTui("hardware cursor"); }
