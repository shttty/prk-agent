import { useEffect, useRef, useState } from "react";

const RESET = { scale: 1, x: 0, y: 0 };

export function ZoomableImage({ src, alt, onError }) {
  const [view, setView] = useState(RESET);
  const stage = useRef(null);
  const pointers = useRef(new Map());
  useEffect(() => {
    const node = stage.current;
    const wheel = (event) => {
      event.preventDefault();
      setView((current) => zoom(current, Math.exp(-Math.sign(event.deltaY) * .16)));
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, []);
  const start = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };
  const move = (event) => {
    const tracked = pointers.current;
    const previous = tracked.get(event.pointerId);
    if (!previous) return;
    const other = [...tracked].find(([id]) => id !== event.pointerId)?.[1];
    const next = { x: event.clientX, y: event.clientY };
    tracked.set(event.pointerId, next);
    const factor = other ? distance(next, other) / Math.max(1, distance(previous, other)) : 1;
    const weight = other ? .5 : 1;
    setView((current) => zoom(current, factor, (next.x - previous.x) * weight, (next.y - previous.y) * weight));
  };
  const finish = (event) => pointers.current.delete(event.pointerId);
  return <div className="pi-image-viewer-stage" ref={stage} data-zoom={view.scale}
    onPointerDown={start} onPointerMove={move} onPointerUp={finish} onLostPointerCapture={finish} onDoubleClick={() => setView(RESET)}>
    <img src={src} alt={alt} onError={onError} draggable={false}
      style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }} />
  </div>;
}

function zoom(current, factor, dx = 0, dy = 0) {
  const scale = Math.max(1, Math.min(8, current.scale * factor));
  return scale === 1 ? RESET : { scale, x: current.x + dx, y: current.y + dy };
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
