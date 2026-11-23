import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { createDialog } from "./create-dialog.ts";

export function editor(ctx: UiContext, title: Parameters<ExtensionUIContext["editor"]>[0], prefill: Parameters<ExtensionUIContext["editor"]>[1]) { return createDialog<string>(ctx, "editor", title, { prefill }); }
