
export function loadExtensionCompletion({ completionRequest, setExtensionCompletion, autocomplete, composerText, extensionCursor, actions }) {
    const token = ++completionRequest.current;
    setExtensionCompletion(null);
    if (!autocomplete || !composerText) return undefined;
    const timer = window.setTimeout(() => {
      const before = composerText.slice(0, extensionCursor).split("\n");
      void actions.extensionUiAction("autocomplete", { lines: composerText.split("\n"), cursorLine: before.length - 1, cursorCol: before.at(-1).length }).then((result) => {
        if (token === completionRequest.current) setExtensionCompletion(result?.data || null);
      });
    }, 100);
    return () => window.clearTimeout(timer);
  }
