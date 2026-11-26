import type { ChatActions } from "../thread/chat-actions-types.ts";
import type { ScrollRef, SetState, RevealOptions } from "./scroll-types.ts";
import { matchTranscriptMessages } from "./match-transcript-messages.ts";

type SelectSearchMatch = {
  searchRequest: ScrollRef<number>; setSearchError: SetState<string>; setSearchMatches: SetState<string[]>; setSearchIndex: SetState<number>; setSearchStatus: SetState<string>;
  actions: ChatActions; revealMessage: (id: string, options?: RevealOptions) => void;
};

export async function selectSearchMatch({ searchRequest, setSearchError, setSearchMatches, setSearchIndex, setSearchStatus, actions, revealMessage }: SelectSearchMatch, query: string, offset: number) {
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
    const target = matches[nextIndex];
    if (target !== undefined) revealMessage(target, { openDetails: true });
  } catch (error) {
    if (request !== searchRequest.current) return;
    setSearchStatus("error");
    setSearchError(error instanceof Error ? error.message : "查找失败。");
    setSearchMatches([]);
  }
}
