import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { classifyImageSource } from "../../markdown/classify-image-source.js";
import { resultImageSource } from "../tool-calls/body/result-image-source.js";
import { imageKey } from "./image-key.js";

const markdown = unified().use(remarkParse).use(remarkGfm);

export function collectTranscriptImages(messages, cells = []) {
  const deliveries = new Map(cells.map((cell) => [cell.toolCallId, cell]));
  const images = [];
  for (const [messageIndex, { id: messageId, role, content, metadata }] of messages.entries()) {
    if (metadata?.custom?.extensionNode) continue;
    if (role === "user") {
      for (const [index, attachment] of (metadata?.custom?.attachments ?? []).entries()) {
        const src = resultImageSource({ type: "image", mimeType: attachment.type, data: attachment.data });
        if (src) images.push({ key: imageKey("attachment", messageId, index), kind: "attachment", messageId, messageNumber: messageIndex + 1, index, src, label: attachment.name || "上传图片" });
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
        const cell = toolName === "kernel_code" && deliveries.get(toolCallId);
        if (cell?.imageCount) {
          for (let index = 0; index < cell.imageCount; index++) {
            images.push({ key: imageKey("kernel", toolCallId, index), kind: "kernel", messageId, toolCallId, cell, index, label: `执行图片 ${index + 1}` });
          }
          continue;
        }
        const result = part.result?.result ?? part.result;
        const sources = Array.isArray(result?.content) ? result.content.filter(({ type }) => type === "image").map(resultImageSource) : [];
        const deferred = part.metadata?.outputPreview?.imageCount && !part.metadata.outputLoaded;
        const count = deferred ? part.metadata.outputPreview.imageCount : sources.length;
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

function markdownImages(text) {
  const root = markdown.parse(text);
  const definitions = new Map();
  const nodes = [];
  const visit = (node) => {
    if (node.type === "definition" && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
    if (node.type === "image" || node.type === "imageReference") nodes.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return nodes.flatMap((node) => {
    const offset = node.position?.start.offset;
    const source = classifyImageSource(node.url ?? definitions.get(node.identifier));
    return source?.kind === "target" && offset !== undefined ? [{ path: source.value, label: node.alt || source.value, offset }] : [];
  });
}
