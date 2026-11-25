// Raster signatures from https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);

export function sniffImage(prefix: Buffer): string | undefined {
  if (prefix.subarray(0, PNG.length).equals(PNG)) return "image/png";
  if (prefix.subarray(0, JPEG.length).equals(JPEG)) return "image/jpeg";
  const gif = prefix.toString("latin1", 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
  if (prefix.toString("latin1", 0, 4) === "RIFF" && prefix.toString("latin1", 8, 12) === "WEBP") return "image/webp";
}
