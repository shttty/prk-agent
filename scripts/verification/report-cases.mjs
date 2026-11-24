import { inspect } from "node:util";

export default async function* report(source) {
  for await (const { type, data } of source) {
    if ((type === "test:pass" || type === "test:fail") && data.details.type !== "suite") {
      if (data.line > 1 || type === "test:fail") {
        const status = data.todo ? "KNOWN FAILURE" : data.skip ? "SKIP" : type === "test:pass" ? "PASS" : "FAIL";
        yield `PRK_CASE ${JSON.stringify({ name: data.name, ms: data.details.duration_ms, status, note: data.todo || data.skip || undefined })}\n`;
      }
      if (type === "test:fail") yield `${data.name}: ${inspect(data.details.error, { depth: 6 })}\n`;
    } else if (type === "test:stdout" || type === "test:stderr") {
      yield data.message;
    }
  }
}
