import { DEFAULT_SESSION_OPTIONS, type SessionOptions } from "../../config/session/session-options.ts";
import { jsonDetail } from "./details/format-error-json-detail.ts";
import { stackFrames } from "./details/read-error-stack-frames.ts";

/**
 * Faithful rendering of a thrown value for Gateway logs: name, message, stack,
 * extra fields and the full cause chain. Only size is bounded.
 */
export function describeError(error: unknown, options: SessionOptions = DEFAULT_SESSION_OPTIONS, seen: Set<unknown> = new Set()): string {
  if (error instanceof Error) {
    if (seen.has(error)) return "[circular error]";
    seen.add(error);
    const headline = `${error.name || "Error"}: ${error.message}`;
    const lines = [headline, ...stackFrames(error.stack, headline, options.errorStackLines)];
    const extras = Object.entries(error)
      .filter(([key]) => !["name", "message", "stack", "cause"].includes(key))
      .map(([key, value]) => `${key}=${jsonDetail(value)}`);
    if (error instanceof AggregateError && Array.isArray(error.errors)) {
      extras.push(`errors=[${error.errors.map((entry) => describeError(entry, options, seen)).join(", ")}]`);
    }
    if (extras.length) lines.push(extras.join(" "));
    if (error.cause !== undefined) lines.push(`caused by: ${describeError(error.cause, options, seen)}`);
    return lines.join("\n");
  }
  if (typeof error === "object") return jsonDetail(error);
  return String(error);
}
