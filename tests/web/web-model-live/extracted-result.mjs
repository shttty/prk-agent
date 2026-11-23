

export function extractedResult(ctx, result, expected, marker) {
  const text = ctx.textOf(result?.content ?? result);
  const line = text.split(/\r?\n/).find((entry) => entry.includes(marker) && entry.includes(String(expected))) ?? "";
  return {
    toolName: result?.toolName,
    toolCallId: result?.toolCallId ?? result?.id,
    marker,
    expected,
    line,
    containsExpected: new RegExp(`${marker}\\s+${expected}(?:\\s|$)`).test(text),
  };
}
