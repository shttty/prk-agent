import "yet-another-react-lightbox/styles.css";
import "./image-viewer.css";
import "./image-viewer-slide-types.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { Loader, Text } from "@mantine/core";
import type { Slide } from "yet-another-react-lightbox";
import type { ImageItem } from "./image-item-types.ts";
import { imageOrigin } from "./image-origin.ts";
import { OpenOriginalButton } from "./OpenOriginalButton.tsx";

type ImageViewerProps = { items: readonly ImageItem[]; index: number; close: () => void; resolve: (item: ImageItem) => Promise<string | undefined> };

const LABELS = { Previous: "上一张", Next: "下一张", Close: "关闭图片预览", "Zoom in": "放大", "Zoom out": "缩小", Lightbox: "图片预览" };
const PLUGINS = [Zoom];
// Wheel zooms like the previous viewer; the ratio lets a small image grow past its natural size.
const ZOOM = { scrollToZoom: true, maxZoomPixelRatio: 8 };
const CONTAINER = { id: "message-image-viewer" };

/** The conversation's images in a yet-another-react-lightbox; an image's bytes load when its slide becomes current. */
export function ImageViewer({ items, index, close, resolve }: ImageViewerProps) {
  const [current, setCurrent] = useState(index);
  const [zoom, setZoom] = useState(1);
  // Resolved source per image key; "" marks one that failed to load.
  const [sources, setSources] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  const item = items[current];
  useEffect(() => {
    if (!item || requested.current.has(item.key)) return;
    requested.current.add(item.key);
    void resolve(item).then((src) => src || "", () => "").then((src) => setSources((all) => ({ ...all, [item.key]: src })));
  }, [item, resolve]);
  const slides = useMemo<Slide[]>(() => items.map((entry) => {
    const src = sources[entry.key];
    return src ? { src, alt: entry.label } : { type: "pending", label: "path" in entry ? entry.path : entry.label, failed: entry.key in sources };
  }), [items, sources]);
  if (!item) return null;
  return <Lightbox open close={close} slides={slides} index={current} plugins={PLUGINS} zoom={ZOOM} labels={LABELS} portal={{ container: CONTAINER }}
    carousel={{ finite: true }} controller={{ closeOnBackdropClick: true }}
    on={{ view: ({ index: next }) => { setCurrent(next); setZoom(1); }, zoom: ({ zoom: level }) => setZoom(level) }}
    toolbar={{ buttons: [<OpenOriginalButton key="open-original" src={sources[item.key]} />, "close"] }}
    render={{
      slide: ({ slide }) => slide.type === "pending"
        ? <div className="pi-image-viewer-status" data-image-status={slide.failed ? "error" : "loading"} role="status">
          {slide.failed ? `无法显示：${slide.label}` : <Loader size="sm" color="gray" aria-label="正在加载图片" />}
        </div> : undefined,
      // The library's controls slot overlays the whole viewer; the caption is placed by image-viewer.css.
      controls: () => <div className="pi-image-viewer-caption" data-zoom={zoom}>
        <Text size="sm" fw={600} c="white" aria-live="polite" data-image-index={current + 1} data-image-total={items.length}>第 {current + 1} / 共 {items.length} 张</Text>
        <Text size="xs" c="gray.4" truncate title={imageOrigin(item)} data-image-source={item.kind}>{imageOrigin(item)}</Text>
      </div>,
    }} />;
}
