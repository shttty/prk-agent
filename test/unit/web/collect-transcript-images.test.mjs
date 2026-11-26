import assert from "node:assert/strict";
import test from "node:test";
import { collectTranscriptImages } from "../../../web/chat/transcript/image-viewer/collect-transcript-images.js";

const attachment = { name: "upload.png", type: "image/png", data: "AAAA" };
const deferred = (toolCallId, toolName, imageCount) => ({ type: "tool-call", toolCallId, toolName, metadata: { outputPreview: { imageCount, version: "v" } } });
const result = { id: "r", summary: "Done", artifacts: ["shot.png", "notes.md", "~/plot.webp"] };
const report = `[派生会话任务结果 / child=c / task=t / result=r]\n${JSON.stringify({ child: "c", taskId: "t", result })}`;
const messages = [
  { id: "user", role: "user", content: [{ type: "text", text: "![Do not show](user.png)" }], metadata: { custom: { attachments: [attachment] } } },
  { id: "peer", role: "user", content: [{ type: "text", text: report }], metadata: { custom: { peerMessage: { sender: "c" }, copyText: report } } },
  { id: "assistant", role: "assistant", content: [
    { type: "text", text: "![One](one.png) ![Offsite](https://example.invalid/a.png) `![Not an image](code.png)`" },
    deferred("tool", "read", 1), deferred("cell1", "kernel_code", 2), deferred("cell2", "kernel_code", 3),
    { type: "text", text: "![Two][plot]\n\n[plot]: ~/two.png" },
  ] },
];

test("lightbox walks loaded messages and parts in order without prefetching offscreen images", () => {
  const images = collectTranscriptImages(messages, [{ toolCallId: "cell2", cellId: "c2", kernelId: "k", imageCount: 1 }]);
  assert.deepEqual(images.map(({ kind, messageId, path, toolCallId, index }) => [kind, messageId, path ?? toolCallId ?? "", index]), [
    ["attachment", "user", "", 0],
    ["artifact", "peer", "shot.png", undefined], ["artifact", "peer", "~/plot.webp", undefined], ["markdown", "assistant", "one.png", undefined],
    ["tool", "assistant", "tool", 0], ["tool", "assistant", "cell1", 0], ["tool", "assistant", "cell1", 1],
    ["kernel", "assistant", "cell2", 0], ["markdown", "assistant", "~/two.png", undefined],
  ]);
  assert.equal(new Set(images.map(({ key }) => key)).size, images.length);
});
