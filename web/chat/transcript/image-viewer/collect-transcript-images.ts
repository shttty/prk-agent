import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Nodes } from "mdast";
import type { KernelCellDelivery } from "../../../../src/gateway/wire/web-types.ts";
import { isPayload } from "../../payload/is-payload.ts";
import type { TranscriptMessage } from "../../conversation/conversation-types.ts";
import { classifyImageSource } from "../../markdown/classify-image-source.ts";
import { resultImageSource } from "../tool-calls/body/result-image-source.ts";
import { imageKey } from "./image-key.ts";
import type { ImageItem } from "./image-item-types.ts";
import { projectPeerBody } from "../messages/peer/project-peer-body.ts";

const markdown = unified().use(remarkParse).use(remarkGfm);

export function collectTranscriptImages(messages: readonly TranscriptMessage[], cells: readonly KernelCellDelivery[] = []): ImageItem[] {
  const deliveries = new Map(cells.map((cell) => [cell.toolCallId, cell]));
  const images: ImageItem[] = [];
  for (const [messageIndex, { id: messageId, role, content, metadata }] of messages.entries()) {
    const custom = metadata?.custom;
    if (custom?.extensionNode) continue;
    if (role === "user") {
      for (const [index, attachment] of (custom?.attachments ?? []).entries()) {
        const src = resultImageSource({ type: "image", mimeType: attachment.type, data: attachment.data });
        if (src) images.push({ key: imageKey("attachment", messageId, index), kind: "attachment", messageId, messageNumber: messageIndex + 1, index, src, label: attachment.name || "上传图片" });
      }
      if (custom?.peerMessage) {
        const report = projectPeerBody(custom.copyText);
        for (const [index, { path, image }] of (report.kind === "result" ? report.artifacts : []).entries()) {
          if (image) images.push({ key: imageKey("artifact", messageId, index), kind: "artifact", messageId, path, label: path });
        }
      }
    }
    if (role !== "assistant") continue;
    for (const [partIndex, part] of content.entries()) {
      if (part.type === "text" && part.text.includes("![")) {
        for (const { path, label, offset } of markdownImages(part.text)) {
          images.push({ key: imageKey("markdown", messageId, partIndex, offset), kind: "markdown", messageId, path, label });
        }
      } else if (part.type === "tool-call") {
        const { toolCallId, toolName } = part;
        const cell = toolName === "kernel_code" ? deliveries.get(toolCallId) : undefined;
        if (cell?.imageCount) {
          for (let index = 0; index < cell.imageCount; index++) {
            images.push({ key: imageKey("kernel", toolCallId, index), kind: "kernel", messageId, toolCallId, cell, index, label: `执行图片 ${index + 1}` });
          }
          continue;
        }
        const result = isPayload(part.result?.result) ? part.result.result : part.result;
        const sources = Array.isArray(result?.content) ? result.content.filter(isPayload).filter(({ type }) => type === "image").map(resultImageSource) : [];
        const deferred = Boolean(part.metadata.outputPreview?.imageCount && !part.metadata.outputLoaded);
        const count = deferred ? part.metadata.outputPreview?.imageCount ?? 0 : sources.length;
        for (let index = 0; index < count; index++) {
          const src = sources[index];
          if (src || deferred) images.push({ key: imageKey("tool", toolCallId, index), kind: "tool", messageId, toolCallId, toolName, index, src,
            metadata: part.metadata, label: `${toolName === "kernel_code" ? "执行图片" : "工具图片"} ${index + 1}` });
        }
      }
    }
  }
  return images;
}

function markdownImages(text: string) {
  const root = markdown.parse(text);
  const definitions = new Map<string, string>();
  const nodes: Extract<Nodes, { type: "image" | "imageReference" }>[] = [];
  const visit = (node: Nodes) => {
    if (node.type === "definition" && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
    if (node.type === "image" || node.type === "imageReference") nodes.push(node);
    if ("children" in node) for (const child of node.children) visit(child);
  };
  visit(root);
  return nodes.flatMap((node) => {
    const offset = node.position?.start.offset;
    const source = classifyImageSource(node.type === "image" ? node.url : definitions.get(node.identifier));
    return source?.kind === "target" && offset !== undefined ? [{ path: source.value, label: node.alt || source.value, offset }] : [];
  });
}
