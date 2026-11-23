import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { publish } from "../publication/publish-revision.ts";

export function setStatus(ctx: UiContext, key: Parameters<ExtensionUIContext["setStatus"]>[0], text: Parameters<ExtensionUIContext["setStatus"]>[1]) { if (text === undefined) ctx.state.status.delete(key); else ctx.state.status.set(key, text); publish(ctx); }
