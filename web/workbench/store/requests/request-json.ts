import { readJsonResponse } from "./read-json-response.ts";
import { RequestError } from "./request-error.ts";

export type RequestOptions = { method?: string; body?: string | Blob; headers?: Record<string, string> };

/** Same-origin JSON call: the parsed body, or a `RequestError` (status 0 when the service cannot be reached). */
export async function requestJson(path: string, options: RequestOptions = {}): Promise<unknown> {
  const request = new Request(new URL(path, location.href), {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let response: Response;
  try { response = await fetch(request); }
  catch (error) {
    if (!(error instanceof TypeError) || request.signal.aborted) throw error;
    throw new RequestError("无法连接工作台服务。", 0, undefined, { cause: error });
  }
  return readJsonResponse(await response.text(), response.status);
}
