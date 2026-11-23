import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";

export function getTheme(ctx: UiContext, name: Parameters<ExtensionUIContext["getTheme"]>[0]) { return ctx.session.resourceLoader.getThemes().themes.find((theme) => theme.name === name); }
