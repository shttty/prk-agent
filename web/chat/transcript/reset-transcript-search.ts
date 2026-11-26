import type { ScrollRef, SetState } from "./scroll-types.ts";

type ResetSearch = { searchRequest: ScrollRef<number>; setSearchMatches: SetState<string[]>; setSearchStatus: SetState<string>; setSearchError: SetState<string> };

export function resetTranscriptSearch({ searchRequest, setSearchMatches, setSearchStatus, setSearchError }: ResetSearch) { ++searchRequest.current; setSearchMatches([]); setSearchStatus(""); setSearchError(""); }
