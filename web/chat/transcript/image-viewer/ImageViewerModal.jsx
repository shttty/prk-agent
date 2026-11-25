import { useEffect, useState } from "react";
import { ActionIcon, Button, Group, Loader, Modal, Text } from "@mantine/core";
import { IconArrowUpRight, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { ZoomableImage } from "./ZoomableImage.jsx";

export function ImageViewerModal({ gallery: { items, index }, close, step, resolve }) {
  const item = items[index];
  useEffect(() => {
    const navigate = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        step(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    document.addEventListener("keydown", navigate);
    return () => document.removeEventListener("keydown", navigate);
  }, [step]);
  const origin = item.kind === "markdown" ? item.path
    : item.kind === "kernel" ? `cell ${item.cell.cellId}`
      : item.kind === "tool" ? `${item.toolName} · ${item.toolCallId}` : `第 ${item.messageNumber} 条消息 · ${item.label}`;
  return <Modal opened onClose={close} title="图片预览" centered size="xl" returnFocus={false} id="message-image-viewer"
    closeButtonProps={{ "aria-label": "关闭图片预览" }}>
    <Group className="pi-image-viewer-nav" gap="sm" justify="space-between" wrap="nowrap">
      <ActionIcon variant="default" size="lg" data-action="previous-image" aria-label="上一张" disabled={index === 0} onClick={() => step(-1)}><IconChevronLeft size={19} /></ActionIcon>
      <div className="pi-image-viewer-caption">
        <Text size="sm" fw={600} aria-live="polite" data-image-index={index + 1} data-image-total={items.length}>第 {index + 1} / 共 {items.length} 张</Text>
        <Text size="xs" c="dimmed" truncate title={origin} data-image-source={item.kind}>{origin}</Text>
      </div>
      <ActionIcon variant="default" size="lg" data-action="next-image" aria-label="下一张" disabled={index === items.length - 1} onClick={() => step(1)}><IconChevronRight size={19} /></ActionIcon>
    </Group>
    <ViewerImage key={item.key} item={item} resolve={resolve} />
  </Modal>;
}

function ViewerImage({ item, resolve }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let current = true;
    const loaded = (value) => { if (current) setSrc(value || ""); };
    void resolve(item).then(loaded, () => loaded(""));
    return () => { current = false; };
  }, [item, resolve]);
  return <>
    {src ? <ZoomableImage src={src} alt={item.label} onError={() => setSrc("")} />
      : <div className="pi-image-viewer-stage" data-image-status={src === null ? "loading" : "error"} role="status">
        {src === null ? <Loader size="sm" aria-label="正在加载图片" /> : `无法显示：${item.path || item.label}`}
      </div>}
    <Group justify="space-between" gap="xs" mt="sm">
      <Text size="xs" c="dimmed">滚轮或双指缩放 · 双击复原</Text>
      {src ? (src.startsWith("data:")
        ? <Button variant="subtle" size="compact-sm" data-action="open-original-image" onClick={() => openDataImage(src)} rightSection={<IconArrowUpRight size={15} />}>打开原图</Button>
        : <Button component="a" href={src} target="_blank" rel="noopener noreferrer" variant="subtle" size="compact-sm" data-action="open-original-image" rightSection={<IconArrowUpRight size={15} />}>打开原图</Button>) : null}
    </Group>
  </>;
}

function openDataImage(src) {
  const comma = src.indexOf(",");
  const image = new Blob([Uint8Array.fromBase64(src.slice(comma + 1))], { type: src.slice(5, comma - ";base64".length) });
  const url = URL.createObjectURL(image);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
