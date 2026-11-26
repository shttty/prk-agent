import type { ThemeLibrary, ThemePreview } from "../../../shared/themes.ts";

export interface ThemesState {
  readonly directory: string;
  readonly methods: {
    list(): ThemeLibrary;
    preview(value: unknown): ThemePreview;
  };
}
