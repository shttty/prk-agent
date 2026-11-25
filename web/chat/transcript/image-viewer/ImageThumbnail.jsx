import { useContext } from "react";
import { ImageViewerContext } from "./image-viewer-context.js";

export function ImageThumbnail({ imageId, className = "", label, title, children }) {
  const open = useContext(ImageViewerContext);
  return <button type="button" className={`pi-image-button ${className}`} data-action="view-message-image" aria-label={`查看原图：${label}`} title={title}
    onClick={(event) => open(imageId, event.currentTarget)}>{children}</button>;
}
