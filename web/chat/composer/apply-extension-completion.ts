import { isPayload } from "../payload/is-payload.ts";
import type { ChatActions } from "../thread/chat-actions-types.ts";
import type { ExtensionCompletion, ExtensionCompletionItem, Setter } from "./composer-types.ts";

type ApplyCompletion = {
  composerText: string; extensionCursor: number; actions: ChatActions; extensionCompletion: Pick<ExtensionCompletion, "prefix">; setComposerText: (text: string) => void;
  setExtensionCompletion: Setter<ExtensionCompletion | null>; setPopupDismissed: Setter<boolean>; setExtensionCursor: Setter<number>;
};

export async function applyExtensionCompletion({ composerText, extensionCursor, actions, extensionCompletion, setComposerText, setExtensionCompletion, setPopupDismissed, setExtensionCursor }: ApplyCompletion, item: ExtensionCompletionItem) {
    const before = composerText.slice(0, extensionCursor).split("\n");
    // Boundary: the plugin's answer arrives as untyped JSON.
    const result: unknown = await actions.extensionUiAction("autocomplete", { autocompleteOperation: "apply", lines: composerText.split("\n"), cursorLine: before.length - 1, cursorCol: before.at(-1)?.length ?? 0, item, prefix: extensionCompletion.prefix });
    const applied = isPayload(result) && isPayload(result.data) ? result.data : null;
    if (!applied || !Array.isArray(applied.lines)) return;
    const lines = applied.lines.map(String);
    setComposerText(lines.join("\n"));
    setExtensionCompletion(null);
    setPopupDismissed(true);
    window.requestAnimationFrame(() => {
      const input = document.getElementById("composer");
      const position = lines.slice(0, Number(applied.cursorLine)).reduce((sum, line) => sum + line.length + 1, 0) + Number(applied.cursorCol);
      if (!(input instanceof HTMLTextAreaElement)) return;
      input.focus(); input.setSelectionRange(position, position);
      setExtensionCursor(position);
    });
  }
