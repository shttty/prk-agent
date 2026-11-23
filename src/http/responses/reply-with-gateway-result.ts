import type { HttpOptions } from "../../config/http/http-options.ts";
import type { ServerResponse } from "node:http";
import { responseJson } from "./write-json.ts";
import { gatewayFailure } from "../request/translate-gateway-failure.ts";

export async function gatewayResponse(http: HttpOptions, response: ServerResponse, fallback: string, operation: () => Promise<unknown>): Promise<void> {
  try {
    responseJson(http, response, 200, await operation());
  } catch (error: unknown) {
    throw gatewayFailure(error, fallback);
  }
}
