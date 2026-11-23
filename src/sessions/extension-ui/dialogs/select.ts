import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { createDialog } from "./create-dialog.ts";

export function select(ctx: UiContext, title: Parameters<ExtensionUIContext["select"]>[0], options: Parameters<ExtensionUIContext["select"]>[1], opts: Parameters<ExtensionUIContext["select"]>[2]) { return createDialog<string>(ctx, "select", title, { options: [...options] }, opts); }
