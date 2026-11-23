import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { publish } from "../publication/publish-revision.ts";

export function setHiddenThinkingLabel(ctx: UiContext, label: Parameters<ExtensionUIContext["setHiddenThinkingLabel"]>[0]) { ctx.state.hiddenThinkingLabel = label; publish(ctx); }
