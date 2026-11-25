import { useCallback, useEffect, useRef, useState } from "react";
import { resetTranscriptSearch } from "./reset-transcript-search.js";
import { selectSearchMatch } from "./select-search-match.js";
import { findCurrentPage } from "./find-current-page.js";
import { closeSearch } from "./close-search.js";

export function useTranscriptSearch({ actions, revealMessage, setFollowing, viewportRef, streamId, sessionId, historyEnd, historyRevision }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchMatches, setSearchMatches] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchStatus, setSearchStatus] = useState("");
  const [searchError, setSearchError] = useState("");
  const searchRequest = useRef(0);
  useEffect(() => { resetTranscriptSearch({ searchRequest, setSearchMatches, setSearchStatus, setSearchError }); }, [streamId, sessionId, historyEnd, historyRevision]);
  const select = useCallback((query, offset = 0) => selectSearchMatch({ searchRequest, setSearchError, setSearchMatches, setSearchIndex, setSearchStatus, actions, revealMessage }, query, offset), [actions, revealMessage]);
  const open = useCallback(() => findCurrentPage({ setSearchOpen, setFollowOutput: setFollowing }), [setFollowing]);
  const close = useCallback(() => closeSearch({ searchRequest, setSearchOpen, setSearchText, setSearchMatches, setSearchIndex }), []);
  useEffect(() => {
    const find = (event) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey || (!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== "f") return;
      const target = event.target;
      if (!viewportRef.current || !sessionId || !(target instanceof Element)) return;
      if (target.closest(".cm-editor, .xterm")) return;
      event.preventDefault();
      open();
    };
    document.addEventListener("keydown", find);
    return () => document.removeEventListener("keydown", find);
  }, [open, sessionId, viewportRef]);
  return { searchOpen, searchStatus, searchMatches, closeSearch: close, searchText, setSearchText, selectSearchMatch: select, searchIndex, searchError, open };
}
