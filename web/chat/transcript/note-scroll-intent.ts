import type { SyntheticEvent } from "react";
import type { ScrollIntent, ScrollRef, ViewportRef } from "./scroll-types.ts";
const UP_KEYS = new Set(["PageUp", "ArrowUp", "Home"]);

type ScrollIntentContext = { viewportRef: ViewportRef; intentRef: ScrollRef<ScrollIntent>; setFollowOutput: (follow: boolean) => void; onUpAtTop?: (viewport: HTMLElement) => void };
/** The React synthetic events and the document's native ones both arrive here. */
type IntentEvent = SyntheticEvent | Event;

/**
 * Reader input that scrolls the transcript up stops following: wheel up, a finger dragging the content down, PageUp /
 * ArrowUp / Home with focus on the page body or inside the transcript. A scrollbar press only arms `intent.scrollbar`;
 * saveScroll stops following when that drag actually moves up. Scroll events alone never stop following: a shrinking
 * transcript or a growing viewport clamps scrollTop and fires the same event.
 */
export function noteScrollIntent({ viewportRef, intentRef, setFollowOutput, onUpAtTop }: ScrollIntentContext, event: IntentEvent) {
  const viewport = viewportRef.current;
  if (!viewport) return;
  const intent = intentRef.current;
  const native = "nativeEvent" in event ? event.nativeEvent : event;
  const stopFollowing = () => {
    if (viewport.scrollTop > 0) setFollowOutput(false);
    onUpAtTop?.(viewport);
  };
  if (native instanceof WheelEvent) {
    if (native.deltaY < 0) stopFollowing();
  } else if (native instanceof TouchEvent && native.type === "touchstart") {
    intent.touchY = native.touches[0]?.clientY ?? null;
  } else if (native instanceof TouchEvent && native.type === "touchmove") {
    const y = native.touches[0]?.clientY;
    if (y === undefined) return;
    if (intent.touchY !== null && y > intent.touchY + 2) stopFollowing();
    intent.touchY = y;
  } else if (native instanceof KeyboardEvent) {
    const target = native.target;
    if (UP_KEYS.has(native.key) && target instanceof Node && (target === target.ownerDocument?.body || viewport.contains(target))) stopFollowing();
  } else if (native instanceof PointerEvent && native.type === "pointerdown") {
    // The viewport's own box past clientWidth is its vertical scrollbar.
    intent.scrollbar = native.target === viewport && native.offsetX >= viewport.clientWidth;
  } else if (native.type === "pointerup" || native.type === "pointercancel") {
    intent.scrollbar = false;
  }
}
