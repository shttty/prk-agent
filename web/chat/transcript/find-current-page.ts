import type { SetState } from "./scroll-types.ts";

export function findCurrentPage({ setSearchOpen, setFollowOutput }: { setSearchOpen: SetState<boolean>; setFollowOutput: (follow: boolean) => void }) {
    setSearchOpen(true);
    setFollowOutput(false);
    window.setTimeout(() => document.getElementById("transcript-search")?.focus({ preventScroll: true }), 0);
  }
