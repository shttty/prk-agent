import { errorMessage } from "./error-message.js";

export function readJsonResponse(text, status) {
  let body;
  try { body = text.trim() ? JSON.parse(text) : {}; }
  catch {
    if (status >= 200 && status < 300) throw new Error("服务响应无法解析。");
  }
  if (status >= 200 && status < 300) return body;
  const error = new Error(errorMessage(body, status));
  error.status = status;
  if (body && typeof body === "object") { error.code = body.code; error.details = body.details; }
  throw error;
}
