import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { publish } from "../publication/publish-revision.ts";

export function setWorkingIndicator(ctx: UiContext, indicator: Parameters<ExtensionUIContext["setWorkingIndicator"]>[0]) { ctx.state.working = indicator === undefined ? { ...ctx.state.working, indicator: undefined } : { ...ctx.state.working, indicator: { ...indicator } }; publish(ctx); }
