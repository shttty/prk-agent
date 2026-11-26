import { useContext } from "react";
import { PresentationContext } from "../../presentation-context.js";
import { ImageThumbnail } from "../../image-viewer/ImageThumbnail.jsx";
import { imageKey } from "../../image-viewer/image-key.js";
/** Result artifact paths; image paths open the transcript lightbox from the session's target, others are text. */
export function PeerArtifacts({ artifacts, messageId }) {
  const showImages = useContext(PresentationContext)?.showImages !== false;
  return <ul className="pi-peer-artifacts" aria-label="产物">
    {artifacts.map(({ path, image }, index) => <li key={index}>
      {image && showImages
        ? <ImageThumbnail className="pi-peer-artifact" imageId={imageKey("artifact", messageId, index)} label={path} title={path}>{path}</ImageThumbnail>
        : <span className="pi-peer-artifact">{path}</span>}
    </li>)}
  </ul>;
}
