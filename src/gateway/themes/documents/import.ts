import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ThemeImport } from "../../../../shared/themes.js";
import type { ThemesState } from "../theme-store-state.ts";

export function importTheme(ctx: ThemesState, value: unknown): ThemeImport {
  const { theme, warnings } = ctx.methods.preview(value);
  const id = randomUUID();
  mkdirSync(ctx.directory, { recursive: true });
  writeFileSync(join(ctx.directory, `${id}.json`), `${JSON.stringify(theme, null, 2)}\n`, { flag: "wx" });
  return { theme: { ...theme, id, builtin: false }, warnings };
}
