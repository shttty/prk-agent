import { Buffer } from "node:buffer";
import type { ImageContent } from "@earendil-works/pi-ai";
import { convertToPng, formatDimensionNote, resizeImage } from "@earendil-works/pi-coding-agent";
import type { CapturedImage } from "./captured-types.ts";

interface ImageModelLike {
  readonly input: readonly string[];
  readonly inputLimits?: {
    readonly images?: {
      readonly resize?: Parameters<typeof resizeImage>[2];
    };
  };
}

export async function normalizeCellImages(
  output: { readonly images: readonly CapturedImage[]; readonly omittedImages: number },
  model?: ImageModelLike,
): Promise<{ images: ImageContent[]; notes: string[] }> {
  if (output.images.length === 0 && output.omittedImages === 0) return { images: [], notes: [] };
  const images: ImageContent[] = [];
  const notes: string[] = [];
  const resizeOptions = model?.inputLimits?.images?.resize;

  for (const captured of output.images) {
    let base64 = captured.data;
    let mimeType = captured.mimeType;
    const hints: string[] = [];

    if (mimeType === "image/bmp") {
      const converted = await convertToPng(base64, "image/bmp");
      if (!converted) {
        notes.push("[Image omitted: could not be converted to a supported inline image format.]");
        continue;
      }
      base64 = converted.data;
      mimeType = converted.mimeType;
      hints.push("[Image converted from image/bmp to image/png.]");
    }

    const resized = await resizeImage(Buffer.from(base64, "base64"), mimeType, resizeOptions);
    if (!resized) {
      notes.push("[Image omitted: could not be resized below the inline image size limit.]");
      continue;
    }
    const dimensionNote = formatDimensionNote(resized);
    if (dimensionNote) hints.push(dimensionNote);
    if (hints.length) notes.push(...hints);
    images.push({ type: "image", data: resized.data, mimeType: resized.mimeType });
  }

  if (output.omittedImages > 0) {
    notes.push(`[${output.omittedImages} additional image outputs omitted.]`);
  }
  if (images.length > 0 && model && !model.input.includes("image")) {
    notes.push("[Current model does not support images. The image will be omitted from this request.]");
  }
  return { images, notes };
}
