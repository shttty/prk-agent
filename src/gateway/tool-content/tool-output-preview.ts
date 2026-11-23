import type { Options, ToolContentPreview } from "./content-types.ts";
import { preview } from "./previews/build-preview.ts";
import { object } from "../wire/is-record.ts";
import { contentText } from "./previews/content-text.ts";
import { outputText } from "./previews/preview-output.ts";

export function toolOutputPreview(result: unknown, options: Options): ToolContentPreview | undefined {
  const hasImage = object(result) && Array.isArray(result.content) && result.content.some((part) => object(part) && part.type === "image");
  return hasImage ? preview(result, contentText(result), options, true) : preview(result, outputText(result), options);
}
