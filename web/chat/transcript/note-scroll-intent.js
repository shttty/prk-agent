const UP_KEYS = new Set(["PageUp", "ArrowUp", "Home"]);

/**
 * Reader input that scrolls the transcript up stops following: wheel up, a finger dragging the content down, PageUp /
 * ArrowUp / Home with focus on the page body or inside the transcript. A scrollbar press only arms `intent.scrollbar`;
 * saveScroll stops following when that drag actually moves up. Scroll events alone never stop following: a shrinking
 * transcript or a growing viewport clamps scrollTop and fires the same event.
 */
export function noteScrollIntent({ viewportRef, intentRef, setFollowOutput, onUpAtTop }, event) {
  const viewport = viewportRef.current;
  if (!viewport) return;
  const intent = intentRef.current;
  const stopFollowing = () => {
    if (viewport.scrollTop > 0) setFollowOutput(false);
    onUpAtTop?.(viewport);
  };
  if (event.type === "wheel") {
    if (event.deltaY < 0) stopFollowing();
  } else if (event.type === "touchstart") {
    intent.touchY = event.touches[0]?.clientY ?? null;
  } else if (event.type === "touchmove") {
    const y = event.touches[0]?.clientY;
    if (y === undefined) return;
    if (intent.touchY !== null && y > intent.touchY + 2) stopFollowing();
    intent.touchY = y;
  } else if (event.type === "keydown") {
    const target = event.target;
    if (UP_KEYS.has(event.key) && (target === target?.ownerDocument?.body || viewport.contains(target))) stopFollowing();
  } else if (event.type === "pointerdown") {
    // The viewport's own box past clientWidth is its vertical scrollbar.
    intent.scrollbar = event.target === viewport && event.nativeEvent.offsetX >= viewport.clientWidth;
  } else if (event.type === "pointerup" || event.type === "pointercancel") {
    intent.scrollbar = false;
  }
}
