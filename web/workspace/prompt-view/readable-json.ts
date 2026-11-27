/**
 * A JSON value laid out for reading: the structure of `JSON.stringify(value, null, 2)`, except that a string with line
 * breaks is written as it is, one line per line, between `"""` marks. For display only; it is not valid JSON.
 */
export function readableJson(value: unknown, pad = ""): string {
  if (typeof value === "string") return value.includes("\n") ? `"""\n${value.split("\n").map((line) => `${pad}  ${line}`).join("\n")}\n${pad}"""` : JSON.stringify(value);
  if (Array.isArray(value)) return value.length ? `[\n${value.map((item) => `${pad}  ${readableJson(item, `${pad}  `)}`).join(",\n")}\n${pad}]` : "[]";
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    return entries.length ? `{\n${entries.map(([key, item]) => `${pad}  ${JSON.stringify(key)}: ${readableJson(item, `${pad}  `)}`).join(",\n")}\n${pad}}` : "{}";
  }
  return JSON.stringify(value) ?? "null";
}
