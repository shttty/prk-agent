/** The sends whose result was unknown when this session's state was last saved, as composer receipts again. */
export function savedUnknownSends(saved) {
  return new Map((saved?.unknownSends || []).map(([requestId, entry]) => [requestId, { status: "unknown", ...entry }]));
}
