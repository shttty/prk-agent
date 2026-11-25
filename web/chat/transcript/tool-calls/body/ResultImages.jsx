import { useContext } from "react";
import { PresentationContext } from "../../presentation-context.js";

import { resultImageSource } from "./result-image-source.js";

/** The result's own ImageContent parts, shown under the text they accompany; honours the 显示图片 setting like message images. */
export function ResultImages({ result }) {
  const context = useContext(PresentationContext);
  const images = Array.isArray(result?.content)
    ? result.content.flatMap((part) => {
      const src = resultImageSource(part);
      return src ? [{ src, mimeType: part.mimeType }] : [];
    })
    : [];
  if (!images.length || context?.showImages === false) return null;
  return <div className="pi-io-images" data-kind="result-images" data-count={images.length}>
    {images.map((image, index) => <img key={index} src={image.src} alt={`图片 ${index + 1}`} data-mime-type={image.mimeType} />)}
  </div>;
}
