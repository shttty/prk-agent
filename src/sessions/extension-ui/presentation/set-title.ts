import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { publish } from "../publication/publish-revision.ts";

export function setTitle(ctx: UiContext, title: Parameters<ExtensionUIContext["setTitle"]>[0]) { ctx.state.title = title; publish(ctx); }
