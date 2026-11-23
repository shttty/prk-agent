
export function findCurrentPage({ setSearchOpen, setFollowOutput }) {
    setSearchOpen(true);
    setFollowOutput(false);
    window.setTimeout(() => document.getElementById("transcript-search")?.focus({ preventScroll: true }), 0);
  }
