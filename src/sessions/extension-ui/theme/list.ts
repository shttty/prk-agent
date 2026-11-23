import type { UiContext } from "../ui-types.ts";

export function getAllThemes(ctx: UiContext) { return ctx.session.resourceLoader.getThemes().themes.flatMap((theme) => theme.name === undefined ? [] : [{ name: theme.name, path: theme.sourcePath }]); }
