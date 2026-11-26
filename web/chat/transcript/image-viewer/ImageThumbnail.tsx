import { useContext } from "react";
import type { ReactNode } from "react";
import { ImageViewerContext } from "./image-viewer-context.ts";

type ImageThumbnailProps = { imageId: string; className?: string; label: string; title?: string; children: ReactNode };

export function ImageThumbnail({ imageId, className = "", label, title, children }: ImageThumbnailProps) {
  const open = useContext(ImageViewerContext);
  return <button type="button" className={`pi-image-button ${className}`} data-action="view-message-image" aria-label={`查看原图：${label}`} title={title}
    onClick={(event) => open?.(imageId, event.currentTarget)}>{children}</button>;
}
