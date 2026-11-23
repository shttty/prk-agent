import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { createDialog } from "./create-dialog.ts";

export function input(ctx: UiContext, title: Parameters<ExtensionUIContext["input"]>[0], placeholder: Parameters<ExtensionUIContext["input"]>[1], opts: Parameters<ExtensionUIContext["input"]>[2]) { return createDialog<string>(ctx, "input", title, { placeholder }, opts); }
