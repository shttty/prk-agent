import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { createDialog } from "./create-dialog.ts";

export function confirm(ctx: UiContext, title: Parameters<ExtensionUIContext["confirm"]>[0], message: Parameters<ExtensionUIContext["confirm"]>[1], opts: Parameters<ExtensionUIContext["confirm"]>[2]) { return createDialog<boolean>(ctx, "confirm", title, { message }, opts).then((value) => value === true); }
