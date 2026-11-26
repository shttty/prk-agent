import { useAui } from "@assistant-ui/react";
import type { ExtraProps } from "react-markdown";
import type { ComponentProps } from "react";
import { ImageThumbnail } from "../transcript/image-viewer/ImageThumbnail.tsx";
import { imageKey } from "../transcript/image-viewer/image-key.ts";
import { targetImageUrl } from "../transcript/image-viewer/target-image-url.ts";
import { useContext, useState } from "react";
import { PresentationContext } from "../transcript/presentation-context.ts";
import { partIndex } from "../transcript/part-index.ts";
import { classifyImageSource } from "./classify-image-source.ts";
import "./message-images.css";

export function SafeImage({ src, alt, title, node }: ComponentProps<"img"> & ExtraProps) {
  const aui = useAui();
  const context = useContext(PresentationContext);
  if (!context || context.showImages === false) return null;
  const { sessionId, target, actions } = context;
  const source = classifyImageSource(src);
  if (!source) return <span className="pi-image-placeholder" data-image-status="error">无法显示图片{src ? `：${src}` : alt ? `：${alt}` : ""}</span>;
  if (source.kind === "external") return <a className="pi-image-placeholder" data-image-status="external" href={source.value} target="_blank" rel="noopener noreferrer" title={title}>{alt ? `${alt} · ` : ""}打开外链图片</a>;
  if (!sessionId || !target) return null;
  const url = targetImageUrl(actions.api, sessionId, target, source.value);
  const id = imageKey("markdown", aui.message.getState().id, partIndex(aui), node?.position?.start.offset);
  return <TargetImage key={url} imageId={id} url={url} path={source.value} alt={alt} title={title} />;
}

function TargetImage({ imageId, url, path, alt, title }: { imageId: string; url: string; path: string; alt?: string; title?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="pi-image-placeholder" data-image-status="error">无法显示图片：{path}</span>;
  return <ImageThumbnail className="pi-message-image" imageId={imageId} label={alt || path} title={title || path}>
    <img src={url} alt={alt || path} loading="lazy" decoding="async" onError={() => setFailed(true)} />
  </ImageThumbnail>;
}
