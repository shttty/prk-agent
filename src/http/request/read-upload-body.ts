import type { IncomingMessage } from "node:http";
import { HttpError } from "./create-error.ts";

export async function* readUploadBody(request: IncomingMessage, idleTimeoutMs: number): AsyncGenerator<Buffer> {
  const source = request.iterator({ destroyOnReturn: false });
  try {
    for (;;) {
      const { promise, reject } = Promise.withResolvers<never>();
      const timer = setTimeout(() => reject(new HttpError(408, "Upload stalled while waiting for request body bytes.")), idleTimeoutMs);
      timer.unref();
      let result: IteratorResult<Buffer>;
      try {
        result = await Promise.race([source.next(), promise]);
      } finally {
        clearTimeout(timer);
      }
      if (result.done) return;
      yield result.value;
    }
  } finally {
    // If a read is pending, let the error response close the connection before the iterator ends.
    void source.return?.(undefined).catch(() => {});
  }
}
