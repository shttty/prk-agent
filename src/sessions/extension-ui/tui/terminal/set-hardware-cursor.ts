import type { UiContext } from "../../ui-types.ts";
import { unsupportedTui } from "./reject-terminal-operation.ts";

export function setShowHardwareCursor(ctx: UiContext) { return unsupportedTui("hardware cursor"); }
