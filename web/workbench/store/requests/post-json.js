import { requestJson } from "./request-json.js";
export function postJson(ctx, path, payload) { return requestJson(ctx, path, { method: "POST", body: JSON.stringify(payload) }); }

