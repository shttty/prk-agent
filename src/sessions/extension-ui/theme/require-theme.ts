import type { UiContext } from "../ui-types.ts";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { unsupportedTui } from "../tui/terminal/reject-terminal-operation.ts";
import { WEB_THEME_PATH } from "../../session-settings/theme-paths.ts";

export function requireTheme(ctx: UiContext): Theme { return ctx.session.resourceLoader.getThemes().themes.find((theme) => theme.sourcePath === WEB_THEME_PATH) ?? unsupportedTui("the PRK web theme"); }
