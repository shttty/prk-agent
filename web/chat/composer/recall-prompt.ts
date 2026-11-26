import type { Setter } from "./composer-types.ts";

type RecallPrompt = { promptHistory: readonly string[]; historyCursor: number | null; setHistoryCursor: Setter<number | null>; setComposerValue: (value: string) => void };

export function recallPrompt({ promptHistory, historyCursor, setHistoryCursor, setComposerValue }: RecallPrompt, delta: number): boolean {
    if (!promptHistory.length) return false;
    const start = historyCursor === null ? promptHistory.length : historyCursor;
    const next = start + delta;
    if (next < 0) return true;
    if (next >= promptHistory.length) { setHistoryCursor(null); setComposerValue(""); return true; }
    setHistoryCursor(next);
    setComposerValue(promptHistory[next] ?? "");
    return true;
  }
