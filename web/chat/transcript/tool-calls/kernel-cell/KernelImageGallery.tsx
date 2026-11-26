import { useContext, useEffect, useState } from "react";
import { ImageThumbnail } from "../../image-viewer/ImageThumbnail.tsx";
import { imageKey } from "../../image-viewer/image-key.ts";
import { useChatState } from "../../../thread/use-chat-state.ts";
import { PresentationContext } from "../../presentation-context.ts";
import { resultImageSource } from "../body/result-image-source.ts";
import { isPayload } from "../../../payload/is-payload.ts";
import type { ToolCallPart } from "../../../conversation/conversation-types.ts";
import type { ChatActions } from "../../../thread/chat-actions-types.ts";
import type { KernelCellRef, KernelImageLoader } from "./kernel-image-types.ts";
import "./kernel-image-gallery.css";

export function KernelImageGallery({ part }: { part: ToolCallPart }) {
  const context = useContext(PresentationContext);
  const sessionId = context?.sessionId;
  const { toolCallId, metadata } = part;
  const delivery = useChatState((state) => state.session.snapshot?.sessionId === sessionId
    ? state.session.snapshot?.kernelCells?.find((cell) => cell.toolCallId === toolCallId) : undefined);
  if (!context || !sessionId || context.showImages === false) return null;
  const key = JSON.stringify([context.streamId, sessionId, toolCallId]);
  if (delivery?.imageCount) return <Gallery key={`${key}:${delivery.kernelId}:${delivery.cellId}`}
    cell={{ ...delivery, sessionId }} loadKernelImage={context.loadKernelImage} count={delivery.imageCount} toolCallId={toolCallId} />;
  if (!metadata.outputPreview?.imageCount) return null;
  return <ForegroundGallery key={`${key}:${metadata.outputPreview.version}`} actions={context.actions} sessionId={sessionId} part={part} />;
}

function ForegroundGallery({ actions, sessionId, part }: { actions: ChatActions; sessionId: string; part: ToolCallPart }) {
  const { toolCallId, metadata } = part;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (metadata.outputLoaded) return;
    let current = true;
    actions.loadToolContent(toolCallId, metadata, { sessionId }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [actions, sessionId, toolCallId, metadata]);
  const result = isPayload(part.result?.result) ? part.result.result : part.result;
  const sources = metadata.outputLoaded && Array.isArray(result?.content) ? result.content.filter(isPayload).filter(({ type }) => type === "image").map(resultImageSource) : undefined;
  return <Gallery toolCallId={toolCallId} count={metadata.outputPreview?.imageCount ?? 0} sources={sources} failed={failed} />;
}

type GalleryProps = { loadKernelImage?: KernelImageLoader | null; cell?: KernelCellRef & { kernelId: string }; toolCallId: string; count: number; sources?: (string | undefined)[]; failed?: boolean };

function Gallery({ loadKernelImage, cell, toolCallId, count, sources, failed }: GalleryProps) {
  return <div className="pi-kernel-gallery" data-kind="kernel-image-gallery" data-cell-id={cell?.cellId}>
    {Array.from({ length: count }, (_, index) => <Thumbnail key={index} index={index + 1} loadKernelImage={loadKernelImage}
      sessionId={cell?.sessionId} toolCallId={toolCallId} kernelId={cell?.kernelId} cellId={cell?.cellId}
      source={sources?.[index]} failed={failed || (sources !== undefined && !sources[index])} />)}
  </div>;
}

type ThumbnailProps = { loadKernelImage?: KernelImageLoader | null; sessionId?: string; kernelId?: string; cellId?: string; toolCallId: string; index: number; source?: string; failed?: boolean };

function Thumbnail({ loadKernelImage, sessionId, kernelId, cellId, toolCallId, index, source, failed }: ThumbnailProps) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!loadKernelImage || !sessionId || !kernelId || !cellId) return;
    let current = true;
    const cell = { sessionId, kernelId, cellId, toolCallId };
    const accept = (src: string | undefined) => { if (current) setLoaded(src || ""); };
    void loadKernelImage(cell, index).then(accept, () => accept(""));
    return () => { current = false; };
  }, [loadKernelImage, sessionId, kernelId, cellId, toolCallId, index]);
  const image = broken || failed ? "" : source ?? loaded;
  const label = `执行图片 ${index}`;
  if (!image) return <span className="pi-kernel-thumbnail" data-image-status={image === null ? "loading" : "error"}>
    {image === null ? `正在加载${label}…` : `无法显示${label}`}
  </span>;
  return <ImageThumbnail className="pi-kernel-thumbnail" imageId={imageKey(cellId ? "kernel" : "tool", toolCallId, index - 1)} label={label}>
    <img src={image} alt={label} decoding="async" onError={() => setBroken(true)} />
  </ImageThumbnail>;
}
