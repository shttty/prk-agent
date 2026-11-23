import { DEFAULT_SESSION_OPTIONS } from "../../config/session/session-options.ts";

export function boundedError(text: string, maxChars: number = DEFAULT_SESSION_OPTIONS.errorDetailChars): string {
  return text.length > maxChars
    ? `${text.slice(0, maxChars)}\n[error detail truncated]`
    : text;
}
