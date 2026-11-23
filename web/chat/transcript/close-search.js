
export function closeSearch({ searchRequest, setSearchOpen, setSearchText, setSearchMatches, setSearchIndex }) {
    ++searchRequest.current;
    setSearchOpen(false);
    setSearchText("");
    setSearchMatches([]);
    setSearchIndex(0);
    document.getElementById("composer")?.focus({ preventScroll: true });
  }
