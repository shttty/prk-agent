import { dataProperty } from "./read-data-property.mjs";

export function visitEncodedValue(ctx, input) {
    if (input === undefined) return ["undefined"];
    if (input === null) return ["null"];
    if (typeof input === "string" || typeof input === "boolean") return [typeof input, input];
    if (typeof input === "number") {
      if (!Number.isFinite(input)) throw new TypeError("Remote extension codec rejects non-finite numbers");
      return ["number", Object.is(input, -0) ? "-0" : input];
    }
    if (typeof input !== "object") throw new TypeError(`Remote extension codec rejects ${typeof input}`);
    if (ctx.has(input)) throw new TypeError("Remote extension codec rejects cycles");
    if (Object.getOwnPropertySymbols(input).length) throw new TypeError("Remote extension codec rejects symbol keys");
    ctx.add(input);
    try {
      if (input instanceof Error) {
        const fields = { name: input.name, message: input.message, stack: input.stack };
        if (Object.hasOwn(input, "cause")) fields.cause = input.cause;
        for (const key of Object.keys(input)) {
          if (!Object.hasOwn(fields, key)) Object.defineProperty(fields, key, { value: dataProperty(input, key), enumerable: true });
        }
        return ["error", visitEncodedValue(ctx, fields)];
      }
      if (Array.isArray(input)) {
        if (Object.keys(input).length !== input.length) throw new TypeError("Remote extension codec rejects sparse arrays and array properties");
        return ["array", Array.from({ length: input.length }, (_, index) => visitEncodedValue(ctx, dataProperty(input, String(index))))];
      }
      const prototype = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Remote extension codec only supports plain objects and Error");
      return ["object", Object.keys(input).map((key) => [key, visitEncodedValue(ctx, dataProperty(input, key))])];
    } finally {
      ctx.delete(input);
    }
}
