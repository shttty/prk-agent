import type { themesList } from "./host-actions/list-themes.ts";
import type { themesPreview } from "./host-actions/preview-theme.ts";
import type { themesImport } from "./host-actions/import-theme.ts";
import type { themesDelete } from "./host-actions/delete-theme.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface ThemesMethods {
  themesList: WithoutContext<typeof themesList>;
  themesPreview: WithoutContext<typeof themesPreview>;
  themesImport: WithoutContext<typeof themesImport>;
  themesDelete: WithoutContext<typeof themesDelete>;
}
