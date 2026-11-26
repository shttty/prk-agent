import { requestJson } from "./request-json.ts";

export function postJson(path: string, payload: unknown): Promise<unknown> { return requestJson(path, { method: "POST", body: JSON.stringify(payload) }); }
