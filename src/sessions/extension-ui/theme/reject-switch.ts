// Like Pi RPC mode: the Web renders with its own palette, so switching the TUI theme is reported as unavailable.
import type { UiContext } from "../ui-types.ts";

export function setTheme(ctx: UiContext) { return ({ success: false, error: "Theme switching is not available in the PRK web host." }); }
