import { join } from "node:path";
import type { ThemeLibrary, ThemePreview, ThemeImport } from "../../../shared/themes.ts";
import type { ThemesState } from "./theme-store-state.ts";
import { list } from "./documents/list.ts";
import { preview } from "./contrast/preview.ts";
import { importTheme } from "./documents/import.ts";
import { deleteTheme } from "./documents/delete.ts";

export class ThemeStore {
  private readonly ctx: ThemesState;
  constructor(home: string) { this.ctx = { directory: join(home, "themes"), methods: this }; }
  list(): ThemeLibrary { return list(this.ctx); }
  preview(value: unknown): ThemePreview { return preview(value); }
  import(value: unknown): ThemeImport { return importTheme(this.ctx, value); }
  delete(id: string): ThemeLibrary { return deleteTheme(this.ctx, id); }
}
