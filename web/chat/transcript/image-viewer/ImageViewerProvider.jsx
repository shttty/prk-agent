import { useCallback, useContext, useRef, useState } from "react";
import { useAui } from "@assistant-ui/react";
import { WorkbenchContext } from "../../../workbench/subscription/workbench-context.js";
import { PresentationContext } from "../presentation-context.js";
import { resultImageSource } from "../tool-calls/body/result-image-source.js";
import { ImageViewerContext } from "./image-viewer-context.js";
import { collectTranscriptImages } from "./collect-transcript-images.js";
import { targetImageUrl } from "./target-image-url.js";
import { ImageViewerModal } from "./ImageViewerModal.jsx";
import "./image-viewer.css";

export function ImageViewerProvider({ children, identity }) {
  const aui = useAui();
  const store = useContext(WorkbenchContext);
  const { actions, sessionId, target, showImages, loadKernelImage } = useContext(PresentationContext);
  const [gallery, setGallery] = useState(null);
  const trigger = useRef(null);
  const open = useCallback((id, node) => {
    if (showImages === false) return;
    const { snapshot } = store.getSnapshot().session;
    const items = collectTranscriptImages(aui.thread.getState().messages, snapshot?.sessionId === sessionId ? snapshot.kernelCells : []);
    const index = items.findIndex(({ key }) => key === id);
    if (index < 0) return;
    trigger.current = node;
    setGallery({ items, index, identity });
  }, [aui, store, sessionId, showImages, identity]);
  const close = useCallback(() => {
    setGallery(null);
    const opener = trigger.current;
    requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
  }, []);
  const step = useCallback((delta) => setGallery((current) => current && ({ ...current, index: Math.max(0, Math.min(current.items.length - 1, current.index + delta)) })), []);
  const resolve = useCallback(async (item) => {
    if (item.src) return item.src;
    if (item.kind === "markdown" || item.kind === "artifact") return targetImageUrl(actions.api, sessionId, target, item.path);
    if (item.kind === "kernel") return loadKernelImage({ ...item.cell, sessionId }, item.index + 1);
    const { result } = await actions.loadToolContent(item.toolCallId, item.metadata, { sessionId });
    const parts = (result?.result ?? result)?.content;
    return Array.isArray(parts) ? resultImageSource(parts.filter(({ type }) => type === "image")[item.index]) : undefined;
  }, [actions, loadKernelImage, sessionId, target]);
  return <ImageViewerContext.Provider value={open}>
    {children}
    {gallery?.identity === identity && showImages !== false ? <ImageViewerModal gallery={gallery} close={close} step={step} resolve={resolve} /> : null}
  </ImageViewerContext.Provider>;
}
