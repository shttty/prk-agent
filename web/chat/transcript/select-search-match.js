import { matchTranscriptMessages } from "./match-transcript-messages.js";

export async function selectSearchMatch({ searchRequest, setSearchError, setSearchMatches, setSearchIndex, setSearchStatus, actions, revealMessage }, query, offset) {
  const request = ++searchRequest.current;
  setSearchError("");
  if (!query.trim()) { setSearchMatches([]); setSearchIndex(0); setSearchStatus(""); return; }
  setSearchStatus("loading");
  try {
    const messages = await actions.loadTranscriptContent();
    // Let the runtime receive the projection with the newly loaded tool content before navigating to it.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (request !== searchRequest.current) return;
    const matches = matchTranscriptMessages(messages, query);
    const nextIndex = matches.length ? ((offset % matches.length) + matches.length) % matches.length : 0;
    setSearchMatches(matches);
    setSearchIndex(nextIndex);
    setSearchStatus("ready");
    if (matches.length) revealMessage(matches[nextIndex], { openDetails: true });
  } catch (error) {
    if (request !== searchRequest.current) return;
    setSearchStatus("error");
    setSearchError(error instanceof Error ? error.message : "查找失败。");
    setSearchMatches([]);
  }
}
