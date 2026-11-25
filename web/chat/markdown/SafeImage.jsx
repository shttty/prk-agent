import { useContext, useState } from "react";
import { PresentationContext } from "../transcript/presentation-context.js";
import { classifyImageSource } from "./classify-image-source.js";
import "./message-images.css";

export function SafeImage({ src, alt, title }) {
  const context = useContext(PresentationContext);
  const { sessionId, target, showImages, actions } = context ?? {};
  if (showImages === false) return null;
  const source = classifyImageSource(src);
  if (!source) return <span className="pi-image-placeholder" data-image-status="error">无法显示图片{src ? `：${src}` : alt ? `：${alt}` : ""}</span>;
  if (source.kind === "external") return <a className="pi-image-placeholder" data-image-status="external" href={source.value} target="_blank" rel="noopener noreferrer" title={title}>{alt ? `${alt} · ` : ""}打开外链图片</a>;
  if (!sessionId || !target) return null;
  const query = new URLSearchParams({ target, path: source.value });
  const url = `${actions.api.root}/sessions/${encodeURIComponent(sessionId)}/files/image?${query}`;
  return <TargetImage key={url} url={url} path={source.value} alt={alt} title={title} />;
}

function TargetImage({ url, path, alt, title }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="pi-image-placeholder" data-image-status="error">无法显示图片：{path}</span>;
  return <a className="pi-message-image" href={url} target="_blank" rel="noopener noreferrer" title={title || path}>
    <img src={url} alt={alt || path} loading="lazy" decoding="async" onError={() => setFailed(true)} />
  </a>;
}
