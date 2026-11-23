import { parseBody } from "./parse-body.js";
import { errorMessage } from "./error-message.js";
export async function requestJson(ctx, path, options = {}) {
    let response;
    try {
      response = await fetch(path, {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {}),
        },
      });
    } catch {
      throw new Error("无法连接工作台服务。");
    }
    const body = parseBody(await response.text());
    if (!response.ok) {
      const error = new Error(errorMessage(body, response.status));
      error.status = response.status;
      if (body && typeof body === "object") { error.code = body.code; error.details = body.details; }
      throw error;
    }
    return body;
  }

