import { useLayoutEffect } from "react";
import { useNoAnimation } from "./use-no-animation.ts";

export function useDocumentMotion(): boolean {
  const noAnimation = useNoAnimation();
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-no-animation", noAnimation);
    if (noAnimation) for (const animation of document.getAnimations()) animation.cancel();
    return () => root.removeAttribute("data-no-animation");
  }, [noAnimation]);
  return noAnimation;
}
