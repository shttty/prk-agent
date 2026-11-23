import { hasText } from "./has-text.js";
/**
 * Parts up to the last tool call or thinking row are the turn's process; the rest is the answer. A finished turn may
 * end with housekeeping calls after its answer (e.g. acknowledging a child result) and an empty text: then the last
 * non-empty text is the answer and stays outside the collapsed process.
 */
export function turnGrouping(parts, finished) {
  const last = parts.findLastIndex((part) => part?.type === "tool-call" || part?.type === "reasoning");
  const all = parts.map((_, index) => index);
  if (last < 0) return [{ groupKey: undefined, indices: all }];
  const tail = all.slice(last + 1);
  if (finished && !tail.some((index) => hasText(parts[index]))) {
    const answer = parts.findLastIndex(hasText);
    if (answer >= 0 && answer < last) {
      return [
        { groupKey: "process", indices: all.filter((index) => index !== answer && index <= last) },
        { groupKey: undefined, indices: [answer, ...tail] },
      ];
    }
  }
  const groups = [{ groupKey: "process", indices: all.slice(0, last + 1) }];
  if (tail.length) groups.push({ groupKey: undefined, indices: tail });
  return groups;
}

export const finishedTurnGrouping = (parts) => turnGrouping(parts, true);

export const runningTurnGrouping = (parts) => turnGrouping(parts, false);
