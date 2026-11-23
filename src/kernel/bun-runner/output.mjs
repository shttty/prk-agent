import { formatWithOptions } from "node:util";

function outputFor(owner) {
  let imageId = 0;
  function stream(stream, text) {
    // JSON escapes can take six bytes per UTF-16 unit. Split before encoding.
    const size = Math.floor((maxFrameBytes - 512) / 6);
    for (let offset = 0; owner.active && offset < text.length; offset += size) {
      owner.emit({ kind: "stream", stream, text: text.slice(offset, offset + size) });
    }
  }
  function log(streamName, args) {
    if (owner.active) stream(streamName, formatWithOptions({ colors: false, maxStringLength: 32768 }, ...args) + "\n");
  }
  const stdout = (...args) => log("stdout", args);
  const stderr = (...args) => log("stderr", args);
  const console = Object.freeze({ log: stdout, info: stdout, debug: stdout, dir: stdout, warn: stderr, error: stderr });
  function display(value) {
    if (!owner.active) return;
    if (value?.data instanceof Uint8Array && /^image\/(png|jpeg|gif|webp|bmp)$/u.test(value.mimeType)) {
      const id = ++imageId;
      const bytes = Buffer.from(value.data.buffer, value.data.byteOffset, value.data.byteLength);
      if (id > maxImages || !bytes.length || bytes.length > maxImageBytes) {
        owner.emit({ kind: "image_omitted" });
        return;
      }
      const size = Math.max(3, blockBytes - blockBytes % 3);
      for (let offset = 0; offset < bytes.length; offset += size) {
        owner.emit({ kind: "image", imageId: id, mimeType: value.mimeType,
          data: bytes.subarray(offset, offset + size).toString("base64"), final: offset + size >= bytes.length });
      }
    } else log("result", [value]);
  }
  return { console, display, stream };
}
