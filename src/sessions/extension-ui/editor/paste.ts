import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { editorChanged } from "./change-text.ts";
import { getEditorText } from "./get-text.ts";

export function pasteToEditor(ctx: UiContext, text: Parameters<ExtensionUIContext["pasteToEditor"]>[0]) { return editorChanged(ctx, getEditorText(ctx) + text); }
