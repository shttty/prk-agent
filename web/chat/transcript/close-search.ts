import type { ScrollRef, SetState } from "./scroll-types.ts";

type CloseSearch = { searchRequest: ScrollRef<number>; setSearchOpen: SetState<boolean>; setSearchText: SetState<string>; setSearchMatches: SetState<string[]>; setSearchIndex: SetState<number> };

export function closeSearch({ searchRequest, setSearchOpen, setSearchText, setSearchMatches, setSearchIndex }: CloseSearch) {
    ++searchRequest.current;
    setSearchOpen(false);
    setSearchText("");
    setSearchMatches([]);
    setSearchIndex(0);
    document.getElementById("composer")?.focus({ preventScroll: true });
  }
