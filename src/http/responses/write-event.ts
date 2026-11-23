import type { HttpOptions } from "../../config/http/http-options.ts";
import type { ServerResponse } from "node:http";

export function responseEvent(http: HttpOptions, response: ServerResponse, event: string, value: unknown): void {
  if (response.destroyed) return;
  let frame: string;
  try {
    frame = `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
  } catch {
    response.destroy();
    return;
  }
  const size = Buffer.byteLength(frame, "utf8");
  if (size > http.outputBytes || response.writableLength + size > http.outputBytes) {
    response.destroy();
    return;
  }
  response.write(frame);
}
