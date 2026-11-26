import { object } from "../wire/is-record.ts";
import type { Options } from "./content-types.ts";
import { toolInputPreview } from "./preview-input.ts";
import { projectResult } from "./projection/format-result.ts";
import { projectMessage } from "./projection/format-message.ts";

export function projectToolDetails(details: Readonly<Record<string, unknown>>, options: Options): Readonly<Record<string, unknown>> {
  const projected = { ...details };
  if (Object.hasOwn(details, "args")) {
    const descriptor = toolInputPreview(details.args, options);
    if (descriptor) { projected.args = {}; projected.inputPreview = descriptor; }
  }
  for (const key of ["result", "partialResult"]) {
    if (!Object.hasOwn(details, key)) continue;
    const result = projectResult(details[key], options);
    projected[key] = result;
    if (object(result) && result.outputPreview) projected.outputPreview = result.outputPreview;
  }
  if (object(details.message)) {
    const message = projectMessage(details.message, options);
    // The user message_end replaces the receiving text with the full SDK body, so it keeps its images (bounded by the
    // attachment limits); every other live message drops them.
    const keepImages = details.sdkType === "message_end" && message.role === "user";
    const content = Array.isArray(message.content) && !keepImages ? message.content.filter((part) => !object(part) || part.type !== "image") : undefined;
    projected.message = Array.isArray(message.content) && content && content.length !== message.content.length ? { ...message, content } : message;
  }
  return projected;
}
