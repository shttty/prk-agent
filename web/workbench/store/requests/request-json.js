import { readJsonResponse } from "./read-json-response.js";

export async function requestJson(ctx, path, options = {}) {
  const request = new Request(new URL(path, location.href), {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  let response;
  try { response = await fetch(request); }
  catch (error) {
    if (error?.name !== "TypeError" || request.signal.aborted) throw error;
    throw Object.assign(new Error("无法连接工作台服务。", { cause: error }), { status: 0 });
  }
  return readJsonResponse(await response.text(), response.status);
}
