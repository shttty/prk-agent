import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { editorChanged } from "./change-text.ts";

export function setEditorText(ctx: UiContext, text: Parameters<ExtensionUIContext["setEditorText"]>[0]) { return editorChanged(ctx, text); }
