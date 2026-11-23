export function composerInputChanged(ctx) {
  const { setExtensionCursor, setComposerText, setCandidateIndex, setHistoryCursor, setPopupDismissed } = ctx;
  const inputChanged = (event) => {
    const value = event.currentTarget.value;
    setExtensionCursor(event.currentTarget.selectionStart);
    setComposerText(value);
    setCandidateIndex(0);
    setHistoryCursor(null);
    setPopupDismissed(false);
  };
  return { inputChanged };
}
