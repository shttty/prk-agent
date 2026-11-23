import type { HttpOptions } from "../../config/http/http-options.ts";
import type { ServerResponse } from "node:http";
import { openEventStream } from "./open-event-stream.ts";
import { responseEvent } from "./write-event.ts";

export function responseSnapshot(http: HttpOptions, response: ServerResponse, value: unknown): void {
  openEventStream(http, response);
  responseEvent(http, response, "snapshot", value);
}
