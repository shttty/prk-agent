import { useContext, useEffect, useState } from "react";
import { Modal } from "@mantine/core";
import { useWorkbench } from "../../../../workbench/subscription/use-workbench.js";
import { PresentationContext } from "../../presentation-context.js";
import { resultImageSource } from "../body/result-image-source.js";
import "./kernel-image-gallery.css";

export function KernelImageGallery({ part }) {
  const { sessionId, showImages, streamId, actions, loadKernelImage } = useContext(PresentationContext);
  const { toolCallId, metadata } = part;
  const delivery = useWorkbench((state) => state.session.snapshot?.sessionId === sessionId
    ? state.session.snapshot.kernelCells?.find((cell) => cell.toolCallId === toolCallId) : undefined);
  const key = JSON.stringify([streamId, sessionId, toolCallId]);
  if (showImages === false) return null;
  if (delivery?.imageCount) return <Gallery key={`${key}:${delivery.kernelId}:${delivery.cellId}`}
    cell={{ ...delivery, sessionId }} loadKernelImage={loadKernelImage} count={delivery.imageCount} />;
  if (!metadata?.outputPreview?.imageCount) return null;
  return <ForegroundGallery key={`${key}:${metadata.outputPreview.version}`} actions={actions} sessionId={sessionId} part={part} />;
}

function ForegroundGallery({ actions, sessionId, part }) {
  const { toolCallId, metadata } = part;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (metadata.outputLoaded) return;
    let current = true;
    actions.loadToolContent(toolCallId, metadata, { sessionId }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [actions, sessionId, toolCallId, metadata]);
  const result = part.result?.result ?? part.result;
  const sources = metadata.outputLoaded ? result?.content?.filter(({ type }) => type === "image").map(resultImageSource) ?? [] : undefined;
  return <Gallery count={metadata.outputPreview.imageCount} sources={sources} failed={failed} />;
}

function Gallery({ loadKernelImage, cell, count, sources, failed }) {
  const [original, setOriginal] = useState(null);
  return <div className="pi-kernel-gallery" data-kind="kernel-image-gallery" data-cell-id={cell?.cellId}>
    {Array.from({ length: count }, (_, index) => <Thumbnail key={index} index={index + 1} loadKernelImage={loadKernelImage}
      sessionId={cell?.sessionId} toolCallId={cell?.toolCallId} kernelId={cell?.kernelId} cellId={cell?.cellId}
      source={sources?.[index]} failed={failed || (sources && !sources[index])} onOpen={setOriginal} />)}
    {original ? <Modal opened onClose={() => setOriginal(null)} title={original.label} size="auto" centered closeButtonProps={{ "aria-label": "关闭原图" }}>
      <img className="pi-kernel-original" src={original.src} alt={original.label} />
    </Modal> : null}
  </div>;
}

function Thumbnail({ loadKernelImage, sessionId, kernelId, cellId, toolCallId, index, source, failed, onOpen }) {
  const [loaded, setLoaded] = useState(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!loadKernelImage) return;
    let current = true;
    const cell = { sessionId, kernelId, cellId, toolCallId };
    const accept = (src) => { if (current) setLoaded(src || ""); };
    void loadKernelImage(cell, index).then(accept, () => accept(""));
    return () => { current = false; };
  }, [loadKernelImage, sessionId, kernelId, cellId, toolCallId, index]);
  const image = broken || failed ? "" : source ?? loaded;
  const label = `执行图片 ${index}`;
  if (!image) return <span className="pi-kernel-thumbnail" data-image-status={image === null ? "loading" : "error"}>
    {image === null ? `正在加载${label}…` : `无法显示${label}`}
  </span>;
  return <button className="pi-kernel-thumbnail" type="button" aria-label={`查看${label}原图`} onClick={() => onOpen({ src: image, label })}>
    <img src={image} alt={label} decoding="async" onError={() => setBroken(true)} />
  </button>;
}
