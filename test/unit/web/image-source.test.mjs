import assert from "node:assert/strict";
import test from "node:test";
import { classifyImageSource } from "../../../web/chat/markdown/classify-image-source.js";

test("markdown image sources distinguish target paths, external links, and invalid source URLs", () => {
  for (const [source, path] of [["/plots/chart.png", "/plots/chart.png"], ["~/chart.jpg", "~/chart.jpg"],
    ["../chart.webp", "../chart.webp"], ["chart%20one.png", "chart one.png"], ["chart%23one.png", "chart#one.png"],
    ["100%.gif", "100%.gif"]]) {
    assert.deepEqual(classifyImageSource(source), { kind: "target", value: path });
  }
  for (const source of ["https://example.invalid/chart.png", "http://example.invalid/chart.gif"]) {
    assert.deepEqual(classifyImageSource(source), { kind: "external", value: source });
  }
  for (const source of [undefined, "", "//example.invalid/chart.png", "javascript:alert(1)", "data:image/png;base64,AA==",
    "file:///tmp/chart.png", "https:///bad.png", "~someone/chart.png", "chart%00.png", "chart%5Cone.png"]) {
    assert.equal(classifyImageSource(source), null, source);
  }
});
