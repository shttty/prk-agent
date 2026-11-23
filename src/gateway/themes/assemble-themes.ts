import { themesList } from "./host-actions/list-themes.ts";
import { themesPreview } from "./host-actions/preview-theme.ts";
import { themesImport } from "./host-actions/import-theme.ts";
import { themesDelete } from "./host-actions/delete-theme.ts";
import type { HostContext } from "../host/host-state.ts";
import type { ThemesMethods } from "./themes-methods.ts";

export function assembleThemes(ctx: HostContext): ThemesMethods {
  return {
    themesList: themesList.bind(undefined, ctx),
    themesPreview: themesPreview.bind(undefined, ctx),
    themesImport: themesImport.bind(undefined, ctx),
    themesDelete: themesDelete.bind(undefined, ctx),
  };
}
