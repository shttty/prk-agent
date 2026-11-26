import { errorMessage } from "./error-message.ts";
import { RequestError } from "./request-error.ts";

/** The parsed body of a 2xx answer; any other status throws a `RequestError` made from the error body. */
export function readJsonResponse(text: string, status: number): unknown {
  let body: unknown;
  try { body = text.trim() ? JSON.parse(text) : {}; }
  catch {
    if (status >= 200 && status < 300) throw new Error("服务响应无法解析。");
  }
  if (status >= 200 && status < 300) return body;
  throw new RequestError(errorMessage(body, status), status, body);
}
