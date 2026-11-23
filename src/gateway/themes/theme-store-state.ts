import type { ThemeLibrary, ThemePreview } from "../../../shared/themes.js";

export interface ThemesState {
  readonly directory: string;
  readonly methods: {
    list(): ThemeLibrary;
    preview(value: unknown): ThemePreview;
  };
}
