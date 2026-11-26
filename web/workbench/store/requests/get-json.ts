import { requestJson } from "./request-json.ts";

export function getJson(path: string): Promise<unknown> { return requestJson(path); }
