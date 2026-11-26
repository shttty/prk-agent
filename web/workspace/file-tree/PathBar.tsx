import { useRef } from "react";
import { useState } from "react";
import { useEffectEvent } from "react";
import { useLayoutEffect } from "react";
import { useElementWidth } from "../../shell/layout/use-element-width.ts";
import { Menu } from "@mantine/core";
type Crumb = { label: string; path: string };

// Folding middle segments into a menu needs the real overflow, so the crumb row is measured here (it only chooses which
// crumbs to render; nothing is positioned from the measurement).
export function PathBar({ items, onGo }: { items: Crumb[]; onGo: (path: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box);
  const sig = `${width}|${items.map((item) => item.label).join("/")}`;
  const [fold, setFold] = useState({ sig, hidden: 0 });
  const hidden = fold.sig === sig ? fold.hidden : 0;
  const measurePath = useEffectEvent(() => {
    const element = box.current;
    if (element && element.scrollWidth > element.clientWidth + 1 && hidden < items.length - 2) setFold({ sig, hidden: hidden + 1 });
  });
  useLayoutEffect(() => {
    measurePath();
  });
  const folded = items.slice(1, 1 + hidden);
  const shown: (Crumb | { fold: true; label?: undefined })[] = hidden && items[0] ? [items[0], { fold: true }, ...items.slice(1 + hidden)] : items;
  const last = items.length - 1;
  const full = items.map((item, index) => (index === 0 && item.label === "/" ? "" : item.label)).join("/") || "/";
  // Only once every middle segment is folded may the current name itself ellipsize.
  const tight = hidden >= items.length - 2;
  return <div className={`pi-files-crumbs${tight ? " is-tight" : ""}`} ref={box} title={full} data-abs-path={full}>
    {shown.map((item, index) => {
      const sep = index > 0 && shown[index - 1]?.label !== "/" ? <span className="pi-files-sep" aria-hidden="true">/</span> : null;
      if (!("path" in item)) {
        return <span key="fold" className="pi-files-crumb-wrap">{sep}<Menu position="bottom-start" withinPortal>
          <Menu.Target><button type="button" className="pi-files-crumb" aria-label="更多上级目录">…</button></Menu.Target>
          <Menu.Dropdown>{folded.map((entry, at) => <Menu.Item key={at} onClick={() => onGo(entry.path)}>{entry.label}</Menu.Item>)}</Menu.Dropdown>
        </Menu></span>;
      }
      const current = item === items[last];
      return <span key={`${index}:${item.label}`} className="pi-files-crumb-wrap">{sep}{current
        ? <span className="pi-files-crumb is-current" aria-current="location">{item.label}</span>
        : <button type="button" className="pi-files-crumb" onClick={() => onGo(item.path)}>{item.label}</button>}</span>;
    })}
  </div>;
}
