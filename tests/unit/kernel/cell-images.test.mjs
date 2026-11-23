import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { normalizeCellImages } from "../../../src/kernel/output/normalize-cell-images.ts";
import { createCell } from "../../../src/kernel/cell/create-cell.ts";
import { captureImage, releaseCellImages } from "../../../src/kernel/output/capture-image.ts";

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const tag = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(Buffer.concat([tag, data])), 0);
  return Buffer.concat([length, tag, data, check]);
}

function makePng(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.alloc(1 + width * 3, 0x42);
  row[0] = 0;
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeBmp2x2() {
  const rowBytes = 8;
  const pixelBytes = rowBytes * 2;
  const fileSize = 54 + pixelBytes;
  const buf = Buffer.alloc(fileSize);
  buf.write("BM", 0, "ascii");
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(2, 18);
  buf.writeInt32LE(2, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixelBytes, 34);
  buf.fill(0x7f, 54);
  return buf;
}


test("normalizeCellImages preserves raster output, converts BMP, bounds dimensions and reports omitted images", async () => {
  const smallPng = makePng(2, 2).toString("base64");
  const largePng = makePng(2400, 1800).toString("base64");
  const bmp = makeBmp2x2().toString("base64");

  const output = { images: [
    { mimeType: "image/png", data: smallPng },
    { mimeType: "image/bmp", data: bmp },
    { mimeType: "image/png", data: largePng },
    ...Array.from({ length: 5 }, () => ({ mimeType: "image/png", data: smallPng })),
  ], omittedImages: 2 };
  const vision = await normalizeCellImages(output, { input: ["text", "image"] });
  assert.equal(vision.images.length, 8);
  assert.equal(vision.images[0].mimeType, "image/png");
  assert.equal(vision.images[1].mimeType, "image/png", "BMP is converted to PNG");
  assert.match(vision.notes.join("\n"), /\[Image converted from image\/bmp to image\/png\.\]/);
  assert.match(vision.notes.join("\n"), /\[Image: original 2400x1800, displayed at /);
  assert.match(vision.notes.join("\n"), /\[2 additional image outputs omitted\.\]/);

  const blind = await normalizeCellImages({ images: output.images.slice(0, 1), omittedImages: 0 }, { input: ["text"] });
  assert.match(blind.notes.join("\n"), /\[Current model does not support images\./);
});

test("generation image budget counts partial bytes, drains an omitted image and reuses released space", () => {
  const process = { generation: "generation", imageBytes: 0 };
  const ctx = { process, clock: { now: () => 0 }, options: { maxImageBytes: 4, maxImages: 1 } };
  const newCell = () => Object.assign(createCell(ctx, { timeoutMs: 0, reminderLadderMs: [] }), { kernelId: process.generation });
  const send = (cell, imageId, data, final = false) => captureImage(ctx, process, cell, { imageId, mimeType: "image/png", data, final });
  const first = newCell();
  const second = newCell();
  const third = newCell();

  send(first, 1, "TQ=");
  send(second, 1, "YWJj");
  send(second, 1, "Z");
  assert.equal(process.imageBytes, 4, "a lone sextet contributes no complete byte");
  send(second, 1, "A");
  assert.equal(process.imageBytes, 1, "only the over-budget image's reservation is returned");
  assert.equal(second.omittedImages, 1);

  send(third, 1, "YWJj", true);
  assert.deepEqual(third.images, [{ mimeType: "image/png", data: "YWJj" }]);
  first.resolve("unknown");
  assert.equal(process.imageBytes, 3, "terminal cleanup returns incomplete storage");
  send(second, 1, "=");
  send(second, 1, "=", true);
  assert.equal(second.omittedImages, 1);
  assert.deepEqual(second.images, []);

  send(second, 2, "T");
  send(second, 2, "Q");
  send(second, 2, "=");
  send(second, 2, "=", true);
  assert.equal(process.imageBytes, 4);
  assert.deepEqual(second.images, [{ mimeType: "image/png", data: "TQ==" }]);

  releaseCellImages(process, third);
  send(second, 3, "Y");
  send(second, 3, "WI=", true);
  assert.equal(second.omittedImages, 2, "the count limit still applies with raw bytes available");
  second.resolve("ok");
  assert.equal(process.imageBytes, 1, "terminal cleanup preserves finalized storage until freeze");
  releaseCellImages(process, second);
  assert.equal(process.imageBytes, 0);
  assert.deepEqual(second.images, []);
});
