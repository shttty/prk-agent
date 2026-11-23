import { object } from "../wire/is-record.ts";
import type { Options, ToolContentPreview } from "./content-types.ts";
import { preview } from "./previews/build-preview.ts";

export function toolInputPreview(args: unknown, options: Options, argumentsError?: string): ToolContentPreview | undefined {
  const value = argumentsError === undefined ? args : { args, argumentsError };
  const text = argumentsError ?? (object(args) && typeof args.code === "string" ? args.code : JSON.stringify(args, null, 2) || "");
  return preview(value, text, options);
}
