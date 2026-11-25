import type { Options, ToolContentPreview } from "./content-types.ts";
import { preview } from "./previews/build-preview.ts";
import { object } from "../wire/is-record.ts";
import { contentText } from "./previews/content-text.ts";
import { outputText } from "./previews/preview-output.ts";

export function toolOutputPreview(result: unknown, options: Options): ToolContentPreview | undefined {
  const imageCount = object(result) && Array.isArray(result.content)
    ? result.content.filter((part) => object(part) && part.type === "image").length : 0;
  const descriptor = preview(result, imageCount ? contentText(result) : outputText(result), options, imageCount > 0);
  return descriptor && imageCount ? { ...descriptor, imageCount } : descriptor;
}
