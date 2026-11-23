import { getPackageDir } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * The theme hosted plugin UI renders with: every foreground token is a distinct 256-color index that
 * the Web maps back to the token and then to its own palette, so the TUI theme never reaches the Web.
 */
export const WEB_THEME_PATH = fileURLToPath(new URL("../../../shared/pi-web-theme.json", import.meta.url));
// Load it and the SDK-shipped themes (for getTheme/getAllThemes) through the public resource loader, without global TUI state.
export const HOSTED_THEME_PATHS = [...["dark", "light"].map((name) => join(getPackageDir(), "dist", "modes", "interactive", "theme", `${name}.json`)), WEB_THEME_PATH];
