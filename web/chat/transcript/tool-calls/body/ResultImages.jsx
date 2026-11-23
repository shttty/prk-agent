import { useContext } from "react";
import { PresentationContext } from "../../presentation-context.js";

// Kernel and Gateway normalize results to these four; anything else stays text-only.
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** The result's own ImageContent parts, shown under the text they accompany; honours the 显示图片 setting like message images. */
export function ResultImages({ result }) {
  const context = useContext(PresentationContext);
  const images = Array.isArray(result?.content)
    ? result.content.filter((part) => part?.type === "image" && IMAGE_MIME_TYPES.has(part.mimeType) && typeof part.data === "string" && part.data)
    : [];
  if (!images.length || context?.showImages === false) return null;
  return <div className="pi-io-images" data-kind="result-images" data-count={images.length}>
    {images.map((image, index) => <img key={index} src={`data:${image.mimeType};base64,${image.data}`} alt={`图片 ${index + 1}`} data-mime-type={image.mimeType} />)}
  </div>;
}
