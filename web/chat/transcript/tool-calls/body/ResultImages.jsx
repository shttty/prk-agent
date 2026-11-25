import { useContext } from "react";
import { ImageThumbnail } from "../../image-viewer/ImageThumbnail.jsx";
import { imageKey } from "../../image-viewer/image-key.js";
import { PresentationContext } from "../../presentation-context.js";

import { resultImageSource } from "./result-image-source.js";

/** The result's own ImageContent parts, shown under the text they accompany; honours the 显示图片 setting like message images. */
export function ResultImages({ toolCallId, result }) {
  const context = useContext(PresentationContext);
  const images = Array.isArray(result?.content)
    ? result.content.filter(({ type }) => type === "image").flatMap((part, index) => {
      const src = resultImageSource(part);
      return src ? [{ src, mimeType: part.mimeType, index }] : [];
    })
    : [];
  if (!images.length || context?.showImages === false) return null;
  return <div className="pi-io-images" data-kind="result-images" data-count={images.length}>
    {images.map(({ src, mimeType, index }) => <ImageThumbnail key={index} imageId={imageKey("tool", toolCallId, index)} label={`工具图片 ${index + 1}`}>
      <img src={src} alt={`工具图片 ${index + 1}`} data-mime-type={mimeType} />
    </ImageThumbnail>)}
  </div>;
}
