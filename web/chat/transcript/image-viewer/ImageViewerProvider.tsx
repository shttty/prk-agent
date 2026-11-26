import { useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAui } from "@assistant-ui/react";
import { useWorkbenchStore } from "../../../workbench/subscription/use-workbench-store.ts";
import { PresentationContext } from "../presentation-context.ts";
import { projectedMessage } from "../../conversation/messages/projected-message.ts";
import { isPayload } from "../../payload/is-payload.ts";
import { resultImageSource } from "../tool-calls/body/result-image-source.ts";
import { ImageViewerContext } from "./image-viewer-context.ts";
import { collectTranscriptImages } from "./collect-transcript-images.ts";
import { targetImageUrl } from "./target-image-url.ts";
import { ImageViewer } from "./ImageViewer.tsx";
import type { ImageItem } from "./image-item-types.ts";

type Gallery = { items: ImageItem[]; index: number; identity: string };

export function ImageViewerProvider({ children, identity }: { children: ReactNode; identity: string }) {
  const aui = useAui();
  const store = useWorkbenchStore();
  const context = useContext(PresentationContext);
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const open = useCallback((id: string, node: HTMLElement) => {
    if (!context || context.showImages === false) return;
    const { snapshot } = store.getSnapshot().session;
    const items = collectTranscriptImages(aui.thread().getState().messages.map(projectedMessage), snapshot?.sessionId === context.sessionId ? snapshot.kernelCells : []);
    const index = items.findIndex(({ key }) => key === id);
    if (index < 0) return;
    trigger.current = node;
    setGallery({ items, index, identity });
  }, [aui, store, context, identity]);
  const close = useCallback(() => {
    setGallery(null);
    const opener = trigger.current;
    requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
  }, []);
  const resolve = useCallback(async (item: ImageItem): Promise<string | undefined> => {
    if (!context?.sessionId || !context.target) return undefined;
    if (item.src) return item.src;
    if (item.kind === "markdown" || item.kind === "artifact") return targetImageUrl(context.actions.api, context.sessionId, context.target, item.path);
    if (item.kind === "kernel") return context.loadKernelImage?.({ ...item.cell, sessionId: context.sessionId }, item.index + 1);
    if (item.kind !== "tool") return undefined;
    const { result } = await context.actions.loadToolContent(item.toolCallId, item.metadata, { sessionId: context.sessionId });
    const settled: unknown = isPayload(result) && isPayload(result.result) ? result.result : result;
    const parts = isPayload(settled) ? settled.content : undefined;
    return Array.isArray(parts) ? resultImageSource(parts.filter((part) => isPayload(part) && part.type === "image")[item.index]) : undefined;
  }, [context]);
  return <ImageViewerContext.Provider value={open}>
    {children}
    {gallery?.identity === identity && context?.showImages !== false ? <ImageViewer items={gallery.items} index={gallery.index} close={close} resolve={resolve} /> : null}
  </ImageViewerContext.Provider>;
}
