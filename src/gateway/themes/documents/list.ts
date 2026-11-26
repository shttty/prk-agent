import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { builtinThemes, type ThemeLibrary } from "../../../../shared/themes.ts";
import type { ThemesState } from "../theme-store-state.ts";
import { parseTheme } from "../parse-theme.ts";

export function list(ctx: ThemesState): ThemeLibrary {
  let files: string[];
  try { files = readdirSync(ctx.directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { themes: builtinThemes }; throw error; }
  return { themes: [...builtinThemes, ...files.filter((file) => file.endsWith(".json")).sort().map((file) => ({
    ...parseTheme(JSON.parse(readFileSync(join(ctx.directory, file), "utf8"))), id: file.slice(0, -5), builtin: false,
  }))] };
}
