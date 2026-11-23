import { useRef } from "react";
import { useEffect } from "react";
export function useBackToClose(open, close) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return undefined;
    globalThis.history.pushState({ ...(globalThis.history.state || {}), piOverlay: true }, "");
    let popped = false;
    const onPop = () => { popped = true; closeRef.current(); };
    globalThis.addEventListener("popstate", onPop);
    return () => {
      globalThis.removeEventListener("popstate", onPop);
      if (!popped && globalThis.history.state?.piOverlay) globalThis.history.back();
    };
  }, [open]);
}
