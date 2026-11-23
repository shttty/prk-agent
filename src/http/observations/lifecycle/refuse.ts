import type { StreamContext } from "../observation-state.ts";
import type { HttpError } from "../../request/create-error.ts";
import { openEventStream } from "../../responses/open-event-stream.ts";
import { responseEvent } from "../../responses/write-event.ts";

/**
 * A subscription refused before its first snapshot: EventSource cannot read an HTTP error status, so the refusal is
 * the stream's only frame, `error` with the JSON error shape, and the stream ends.
 */
export const refuseStream = (ctx: StreamContext, error: HttpError): void => {
  ctx.ended = true;
  ctx.unsubscribe?.();
  if (ctx.response.destroyed) return;
  openEventStream(ctx.http, ctx.response);
  responseEvent(ctx.http, ctx.response, "error", { error: error.message, ...(error.code ? { code: error.code, ...(error.details ? { details: error.details } : {}) } : {}) });
  ctx.response.end();
};
