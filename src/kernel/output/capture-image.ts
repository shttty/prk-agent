import type { KernelCell, KernelContext, KernelProcess } from "../kernel-state.ts";

interface ImageMessage {
  imageId: number;
  mimeType: string;
  data: string;
  final: boolean;
}

export function captureImage(ctx: KernelContext, process: KernelProcess, cell: KernelCell, message: ImageMessage): void {
  const { imageId, mimeType, data, final } = message;
  const image = cell.image ??= { id: imageId, mimeType, chunks: [], chars: 0, omitted: false };
  if (image.id !== imageId || image.mimeType !== mimeType) throw new Error("Interleaved image payload.");
  if (!/^image\/(png|jpeg|gif|webp|bmp)$/u.test(mimeType) || !/^[A-Za-z0-9+/=]*$/u.test(data)) throw new Error("Invalid image payload.");

  if (!image.omitted) {
    const last = image.chunks.at(-1);
    const reserved = prefixBytes(image.chars, last, image.chunks.at(-2));
    const bytes = data ? prefixBytes(image.chars + data.length, data, last) - reserved : 0;
    if (cell.images.length >= ctx.options.maxImages || process.imageBytes + bytes > ctx.options.maxImageBytes) {
      process.imageBytes -= reserved;
      cell.imageBytes -= reserved;
      image.chunks.length = 0;
      image.chars = 0;
      image.omitted = true;
      cell.omittedImages++;
    } else if (data) {
      process.imageBytes += bytes;
      cell.imageBytes += bytes;
      image.chars += data.length;
      image.chunks.push(data);
    }
  }

  if (final) {
    if (!image.omitted) cell.images.push({ mimeType, data: image.chunks.join("") });
    cell.image = undefined;
  }
}

export function discardPartialImage(process: KernelProcess, cell: KernelCell): void {
  const image = cell.image;
  if (!image) return;
  const bytes = prefixBytes(image.chars, image.chunks.at(-1), image.chunks.at(-2));
  process.imageBytes -= bytes;
  cell.imageBytes -= bytes;
  cell.image = undefined;
}

export function releaseCellImages(process: KernelProcess, cell: KernelCell): void {
  process.imageBytes -= cell.imageBytes;
  cell.imageBytes = 0;
  cell.image = undefined;
  cell.images.length = 0;
}

function prefixBytes(chars: number, last: string | undefined, previous: string | undefined): number {
  // Frames slice one base64 string. A partial quartet contributes only whole bytes,
  // excluding padding even when the two '=' characters arrive in separate frames.
  const padding = !last?.endsWith("=") ? 0
    : last.endsWith("==") || (last === "=" && previous?.endsWith("=")) ? 2 : 1;
  return Math.floor((chars - padding) * 3 / 4);
}
