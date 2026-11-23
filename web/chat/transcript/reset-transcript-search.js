
export function resetTranscriptSearch({ searchRequest, setSearchMatches, setSearchStatus, setSearchError }) { ++searchRequest.current; setSearchMatches([]); setSearchStatus(""); setSearchError(""); }
