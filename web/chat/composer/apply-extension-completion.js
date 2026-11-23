
export async function applyExtensionCompletion({ composerText, extensionCursor, actions, extensionCompletion, setComposerText, setExtensionCompletion, setPopupDismissed, setExtensionCursor }, item) {
    const before = composerText.slice(0, extensionCursor).split("\n");
    const result = await actions.extensionUiAction("autocomplete", { autocompleteOperation: "apply", lines: composerText.split("\n"), cursorLine: before.length - 1, cursorCol: before.at(-1).length, item, prefix: extensionCompletion.prefix });
    const applied = result?.data;
    if (!Array.isArray(applied?.lines)) return;
    setComposerText(applied.lines.join("\n"));
    setExtensionCompletion(null);
    setPopupDismissed(true);
    window.requestAnimationFrame(() => {
      const input = document.getElementById("composer");
      const position = applied.lines.slice(0, applied.cursorLine).reduce((sum, line) => sum + line.length + 1, 0) + applied.cursorCol;
      input?.focus(); input?.setSelectionRange(position, position);
      setExtensionCursor(position);
    });
  }
