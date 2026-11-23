
export function recallPrompt({ promptHistory, historyCursor, setHistoryCursor, setComposerValue }, delta) {
    if (!promptHistory.length) return false;
    const start = historyCursor === null ? promptHistory.length : historyCursor;
    const next = start + delta;
    if (next < 0) return true;
    if (next >= promptHistory.length) { setHistoryCursor(null); setComposerValue(""); return true; }
    setHistoryCursor(next);
    setComposerValue(promptHistory[next]);
    return true;
  }
