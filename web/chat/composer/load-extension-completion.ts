import { isPayload } from "../payload/is-payload.ts";
import type { ChatActions } from "../thread/chat-actions-types.ts";
import type { ExtensionCompletion, Setter } from "./composer-types.ts";

type LoadCompletion = {
  completionRequest: { current: number }; setExtensionCompletion: Setter<ExtensionCompletion | null>; autocomplete: boolean | undefined;
  composerText: string; extensionCursor: number; actions: ChatActions;
};

export function loadExtensionCompletion({ completionRequest, setExtensionCompletion, autocomplete, composerText, extensionCursor, actions }: LoadCompletion) {
    const token = ++completionRequest.current;
    setExtensionCompletion(null);
    if (!autocomplete || !composerText) return undefined;
    const timer = window.setTimeout(() => {
      const before = composerText.slice(0, extensionCursor).split("\n");
      void actions.extensionUiAction("autocomplete", { lines: composerText.split("\n"), cursorLine: before.length - 1, cursorCol: before.at(-1)?.length ?? 0 }).then((result: unknown) => {
        // Boundary: the plugin's completion answer arrives as untyped JSON.
        const data = isPayload(result) ? result.data : null;
        if (token === completionRequest.current) setExtensionCompletion(isPayload(data) ? data as ExtensionCompletion : null);
      });
    }, 100);
    return () => window.clearTimeout(timer);
  }
