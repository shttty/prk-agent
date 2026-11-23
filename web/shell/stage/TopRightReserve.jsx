import { useLayoutEffect } from "react";
import { useRef } from "react";
import { useState } from "react";

/** The right end of every group's header in the stage. The group in the stage's top-right corner gets
 * `--pi-dock-reserve` of room here (the strip and the control group float over that corner), so its tabs never slide
 * under them. Which group that is follows the layout: it is measured, not tracked, and re-measured after every split,
 * move or resize. */
export function TopRightReserve({ containerApi }) {
  const ref = useRef(null);
  const [corner, setCorner] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    const body = node?.closest(".pi-desktop-stage");
    if (!body) return undefined;
    const measure = () => {
      const mine = node.getBoundingClientRect();
      const box = body.getBoundingClientRect();
      // Within a card gap of the frame's corner: the stage pads every group by half a gap.
      setCorner(mine.top - box.top < 12 && box.right - mine.right < 12);
    };
    measure();
    const layout = containerApi.onDidLayoutChange(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => { layout.dispose(); observer.disconnect(); };
  }, [containerApi]);
  return <div ref={ref} className="pi-dock-reserve" data-corner={corner ? "true" : undefined} />;
}
