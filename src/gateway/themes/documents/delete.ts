import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { builtinThemes, type ThemeLibrary } from "../../../../shared/themes.ts";
import { WireError } from "../../wire/create-error.ts";
import type { ThemesState } from "../theme-store-state.ts";

export function deleteTheme(ctx: ThemesState, id: string): ThemeLibrary {
  if (builtinThemes.some((theme) => theme.id === id)) throw new WireError("INVALID_REQUEST", "内置主题不可删除。");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(id)) throw new WireError("INVALID_REQUEST", "无效主题 id。");
  try { unlinkSync(join(ctx.directory, `${id}.json`)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  return ctx.methods.list();
}
