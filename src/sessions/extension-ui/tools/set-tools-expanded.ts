import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { publish } from "../publication/publish-revision.ts";

export function setToolsExpanded(ctx: UiContext, expanded: Parameters<ExtensionUIContext["setToolsExpanded"]>[0]) { ctx.state.toolsExpanded = expanded; publish(ctx); }
