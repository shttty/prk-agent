import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { publish } from "../publication/publish-revision.ts";

export function setWorkingVisible(ctx: UiContext, visible: Parameters<ExtensionUIContext["setWorkingVisible"]>[0]) { ctx.state.working = { ...ctx.state.working, visible }; publish(ctx); }
