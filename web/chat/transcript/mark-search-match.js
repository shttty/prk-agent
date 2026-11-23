
export function markSearchMatch({ searchMatches, searchIndex }) {
    searchMatches.forEach((node, index) => node.classList.toggle("pi-search-match", index === searchIndex));
    return () => searchMatches.forEach((node) => node.classList.remove("pi-search-match"));
  }
