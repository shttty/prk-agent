import type { ThemePreview } from "../../../../shared/themes.js";
import { parseTheme } from "../parse-theme.ts";
import { themeWarnings } from "../inspect-contrast.ts";

export function preview(value: unknown): ThemePreview {
  const theme = parseTheme(value);
  return { theme, warnings: themeWarnings(theme) };
}
