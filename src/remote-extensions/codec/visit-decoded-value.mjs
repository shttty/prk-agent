import { invalid } from "./reject-malformed-value.mjs";

export function visitDecodedValue(ctx, input) {
    if (!Array.isArray(input) || ctx.has(input)) return invalid();
    ctx.add(input);
    try {
      const [tag, body] = input;
      if (tag === "undefined" && input.length === 1) return undefined;
      if (tag === "null" && input.length === 1) return null;
      if (input.length !== 2) return invalid();
      if (tag === "string" && typeof body === "string") return body;
      if (tag === "boolean" && typeof body === "boolean") return body;
      if (tag === "number") {
        if (body === "-0") return -0;
        if (typeof body === "number" && Number.isFinite(body)) return body;
        return invalid();
      }
      if (tag === "array" && Array.isArray(body)) return Array.from(body, (value) => visitDecodedValue(ctx, value));
      if (tag === "object" && Array.isArray(body)) {
        const result = {};
        for (const entry of body) {
          if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || Object.hasOwn(result, entry[0])) return invalid();
          Object.defineProperty(result, entry[0], { value: visitDecodedValue(ctx, entry[1]), enumerable: true, writable: true, configurable: true });
        }
        return result;
      }
      if (tag === "error") {
        const fields = visitDecodedValue(ctx, body);
        if (!fields || typeof fields !== "object" || Array.isArray(fields) || fields instanceof Error || typeof fields.name !== "string" || typeof fields.message !== "string" || (fields.stack !== undefined && typeof fields.stack !== "string")) return invalid();
        const error = new Error(fields.message);
        for (const [key, item] of Object.entries(fields)) {
          Object.defineProperty(error, key, { value: item, enumerable: !["name", "message", "stack", "cause"].includes(key), configurable: true, writable: true });
        }
        return error;
      }
      return invalid();
    } finally {
      ctx.delete(input);
    }
}
