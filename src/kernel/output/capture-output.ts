import type { CapturedOutput } from "../kernel-types.ts";

export function addOutput(state: CapturedOutput, value: string, options: { maxOutputChars: number }): void {
  if (!value) return;
  const limit = options.maxOutputChars;
  if (!state.truncated && state.text.length + value.length <= limit) {
    state.text += value;
    return;
  }
  const combined = (state.truncated ? state.tail : state.text) + value;
  let start = Math.max(0, combined.length - Math.floor(limit / 2));
  if (/[\uDC00-\uDFFF]/u.test(combined[start] ?? "")) start++;
  if (!state.truncated) {
    let end = Math.ceil(limit / 2);
    if (/[\uDC00-\uDFFF]/u.test(combined[end] ?? "")) end--;
    state.text = combined.slice(0, end);
    state.omittedChars = start - end;
  } else state.omittedChars += start;
  state.tail = combined.slice(start);
  state.truncated = true;
}
