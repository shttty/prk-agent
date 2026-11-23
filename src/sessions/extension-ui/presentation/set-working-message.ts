import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { publish } from "../publication/publish-revision.ts";

export function setWorkingMessage(ctx: UiContext, message: Parameters<ExtensionUIContext["setWorkingMessage"]>[0]) { ctx.state.working = message === undefined ? { ...ctx.state.working, message: undefined } : { ...ctx.state.working, message }; publish(ctx); }
